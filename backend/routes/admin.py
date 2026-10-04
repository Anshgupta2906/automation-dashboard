from datetime import datetime
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SubscriptionUpdate(BaseModel):
    plan: str = Field(pattern="^(none|message_shooter|lead_distributor|all_in_one)$")
    status: str = Field(pattern="^(pending|active|paused|suspended|expired)$")
    expires_at: datetime | None = None


def _require_admin_configured():
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    if not email or not password:
        raise HTTPException(
            status_code=503,
            detail="Admin account is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD on the backend.",
        )
    return email, password


@router.post("/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    admin_email, admin_password = _require_admin_configured()

    if not secrets.compare_digest(email, admin_email) or not secrets.compare_digest(password, admin_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token({"sub": admin_email, "role": "admin"}),
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {"email": admin_email, "role": "admin"},
    }


@router.get("/customers")
def list_customers(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    rows = (
        db.query(User, Subscription)
        .outerjoin(Subscription, Subscription.user_id == User.id)
        .order_by(User.created_at.desc())
        .all()
    )

    customers = []
    for user, subscription in rows:
        customers.append({
            "id": user.id,
            "email": user.email,
            "created_at": user.created_at,
            "plan": subscription.plan if subscription else "none",
            "status": subscription.status if subscription else "pending",
            "expires_at": subscription.expires_at if subscription else None,
        })
    return customers


@router.patch("/customers/{user_id}/subscription")
def update_customer_subscription(
    user_id: int,
    payload: SubscriptionUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")

    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if not subscription:
        subscription = Subscription(user_id=user.id, plan=payload.plan, status=payload.status)
        db.add(subscription)
    else:
        subscription.plan = payload.plan
        subscription.status = payload.status

    subscription.expires_at = payload.expires_at
    subscription.paused_at = datetime.utcnow() if payload.status == "paused" else None

    # Keep legacy feature flags synchronized with the assigned plan.
    user.has_message_shooter = payload.plan in {"message_shooter", "all_in_one"}
    user.has_lead_distributor = payload.plan in {"lead_distributor", "all_in_one"}

    db.commit()
    db.refresh(subscription)

    return {
        "id": user.id,
        "email": user.email,
        "plan": subscription.plan,
        "status": subscription.status,
        "expires_at": subscription.expires_at,
    }


@router.delete("/customers/{user_id}")
def delete_customer(
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        db.execute(text("""
            DELETE FROM call_logs
            WHERE staff_id IN (SELECT id FROM staff_members WHERE broker_id = :broker_id)
        """), {"broker_id": user_id})
        db.execute(text("""
            DELETE FROM calling_sessions
            WHERE staff_id IN (SELECT id FROM staff_members WHERE broker_id = :broker_id)
        """), {"broker_id": user_id})
        db.execute(text("""
            DELETE FROM distribution_history
            WHERE staff_id IN (SELECT id FROM staff_members WHERE broker_id = :broker_id)
        """), {"broker_id": user_id})
        db.execute(text("DELETE FROM staff_members WHERE broker_id = :broker_id"), {"broker_id": user_id})
        db.execute(text("DELETE FROM distribution_configs WHERE broker_id = :broker_id"), {"broker_id": user_id})
        db.execute(text("DELETE FROM distribution_contacts WHERE broker_id = :broker_id"), {"broker_id": user_id})
        db.execute(text("""
            DELETE FROM message_logs
            WHERE contact_id IN (SELECT id FROM message_contacts WHERE broker_id = :broker_id)
               OR campaign_id IN (SELECT id FROM message_campaigns WHERE broker_id = :broker_id)
        """), {"broker_id": user_id})
        db.execute(text("DELETE FROM message_contacts WHERE broker_id = :broker_id"), {"broker_id": user_id})
        db.execute(text("DELETE FROM message_campaigns WHERE broker_id = :broker_id"), {"broker_id": user_id})
        db.execute(text("DELETE FROM subscriptions WHERE user_id = :broker_id"), {"broker_id": user_id})
        db.execute(text("DELETE FROM users WHERE id = :broker_id"), {"broker_id": user_id})
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Customer deletion failed. No changes were saved.")

    return {"status": "deleted", "message": "Customer account deleted."}
