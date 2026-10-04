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


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    payload = _decode_token(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin account required")
    return payload


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

    subscription = db.query(Subscription).filter(Subscription.user_id == staff.broker_id).first()
    if subscription and subscription.status == "paused":
        raise HTTPException(status_code=403, detail="The broker plan is currently paused. Staff access is unavailable.")

    return staff
