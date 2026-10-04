from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.distribution import StaffMember
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.services.auth_service import ALGORITHM, SECRET_KEY

security = HTTPBearer(auto_error=False)


def _decode_token(credentials: HTTPAuthorizationCredentials):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            raise ValueError("Missing subject")
        return payload
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = _decode_token(credentials)
    if payload.get("role", "broker") != "broker":
        raise HTTPException(status_code=403, detail="Broker account required")

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid broker token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CALLING_PLAN = "all_in_one"

def require_subscription_feature(db: Session, user: User, feature: str) -> Subscription:
    """Enforce the admin-assigned subscription before a broker feature is used."""
    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()

    if subscription is None:
        if user.has_message_shooter and user.has_lead_distributor:
            plan = "all_in_one"
        elif user.has_message_shooter:
            plan = "message_shooter"
        elif user.has_lead_distributor:
            plan = "lead_distributor"
        else:
            plan = "none"
        subscription = Subscription(user_id=user.id, plan=plan, status="active")
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

    if subscription.status != "active":
        raise HTTPException(status_code=403, detail=f"Your subscription is {subscription.status}. Contact the administrator.")

    if subscription.expires_at:
        expiry = subscription.expires_at
        now = datetime.now(timezone.utc) if expiry.tzinfo else datetime.utcnow()
        if expiry <= now:
            raise HTTPException(status_code=403, detail="Your subscription has expired. Contact the administrator.")

    allowed_plans = {
        "message_shooter": {"message_shooter", "all_in_one"},
        "lead_distributor": {"lead_distributor", "all_in_one"},
        "calling": {"all_in_one"},
    }
    if feature not in allowed_plans:
        raise HTTPException(status_code=500, detail="Unknown subscription feature")
    if subscription.plan not in allowed_plans[feature]:
        raise HTTPException(status_code=403, detail="This feature is not included in your current plan.")

    return subscription

def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    payload = _decode_token(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin account required")
    return payload


def get_current_staff(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> StaffMember:
    payload = _decode_token(credentials)
    if payload.get("role") != "staff":
        raise HTTPException(status_code=403, detail="Staff account required")

    try:
        staff_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid staff token")

    staff = db.query(StaffMember).filter(
        StaffMember.id == staff_id,
        StaffMember.is_active.is_(True),
    ).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Staff account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    broker = db.query(User).filter(User.id == staff.broker_id).first()
    if not broker:
        raise HTTPException(status_code=401, detail="Broker account no longer exists")

    require_subscription_feature(db, broker, "calling")
    return staff
