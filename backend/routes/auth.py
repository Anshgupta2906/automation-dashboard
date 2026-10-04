from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.auth import get_current_staff, get_current_user
from backend.database import get_db
from backend.models.distribution import StaffMember
from backend.models.user import User
from backend.schemas.distribution_schema import StaffPasswordChange
from backend.schemas.user_schema import AccountDeleteRequest, UserLogin, UserRegister, UserResponse
from backend.services.auth_service import create_access_token, hash_password, login_user, register_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user: UserRegister, db: Session = Depends(get_db)):
    db_user = register_user(
        db,
        email=user.email,
        password=user.password,
        has_message_shooter=user.has_message_shooter,
        has_lead_distributor=user.has_lead_distributor,
    )
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return db_user


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = login_user(db, email=user.email, password=user.password)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token({"sub": str(db_user.id), "role": "broker"}),
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "role": "broker",
            "has_message_shooter": db_user.has_message_shooter,
            "has_lead_distributor": db_user.has_lead_distributor,
        },
    }


@router.post("/staff-login")
def staff_login(user: UserLogin, db: Session = Depends(get_db)):
    email = user.email.strip().lower()
    staff = db.query(StaffMember).filter(
        StaffMember.email == email,
        StaffMember.is_active.is_(True),
    ).first()

    if not staff or not staff.password_hash or not verify_password(user.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid staff email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token({"sub": str(staff.id), "role": "staff"}),
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {
            "id": staff.id,
            "name": staff.name,
            "email": staff.email,
            "role": "staff",
            "broker_id": staff.broker_id,
            "must_change_password": staff.must_change_password,
        },
    }


@router.post("/staff/change-password")
def change_staff_password(
    request: StaffPasswordChange,
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    if not verify_password(request.current_password, current_staff.password_hash or ""):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if request.current_password == request.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")

    current_staff.password_hash = hash_password(request.new_password)
    current_staff.must_change_password = False
    db.commit()

    return {"status": "ok", "message": "Password changed successfully. You can continue using the dashboard."}


@router.delete("/account")
def delete_account(
    request: AccountDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(request.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect",
        )

    try:
        # Delete dependent broker data first so PostgreSQL foreign-key constraints
        # do not leave orphaned records behind.
        db.execute(
            text("""
                DELETE FROM call_logs
                WHERE staff_id IN (
                    SELECT id FROM staff_members WHERE broker_id = :broker_id
                )
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM calling_sessions
                WHERE staff_id IN (
                    SELECT id FROM staff_members WHERE broker_id = :broker_id
                )
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM distribution_history
                WHERE staff_id IN (
                    SELECT id FROM staff_members WHERE broker_id = :broker_id
                )
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM staff_members
                WHERE broker_id = :broker_id
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM distribution_configs
                WHERE broker_id = :broker_id
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM distribution_contacts
                WHERE broker_id = :broker_id
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM message_logs
                WHERE contact_id IN (
                    SELECT id FROM message_contacts WHERE broker_id = :broker_id
                )
                OR campaign_id IN (
                    SELECT id FROM message_campaigns WHERE broker_id = :broker_id
                )
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM message_contacts
                WHERE broker_id = :broker_id
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM message_campaigns
                WHERE broker_id = :broker_id
            """),
            {"broker_id": current_user.id},
        )
        db.execute(
            text("""
                DELETE FROM users
                WHERE id = :broker_id
            """),
            {"broker_id": current_user.id},
        )

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account deletion failed. No changes were saved.",
        )

    return {"status": "deleted", "message": "Account and all associated data have been permanently deleted."}


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user
