import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models.distribution import StaffMember
from backend.models.user import User
from backend.schemas.distribution_schema import StaffMemberCreate, StaffMemberResponse
from backend.services.auth_service import hash_password

router = APIRouter(prefix="/api/staff-accounts", tags=["staff-accounts"])


def generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("", response_model=StaffMemberResponse, status_code=status.HTTP_201_CREATED)
def create_staff_account(
    staff: StaffMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    email = str(staff.email).strip().lower()

    existing_staff = db.query(StaffMember).filter(
        func.lower(StaffMember.email) == email,
        StaffMember.is_active.is_(True),
    ).first()
    if existing_staff:
        raise HTTPException(status_code=409, detail="A staff account with this email already exists")

    new_staff = StaffMember(
        broker_id=current_user.id,
        name=staff.name.strip(),
        email=email,
        password_hash=hash_password(staff.password),
        must_change_password=True,
        is_active=True,
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


@router.post("/{staff_id}/reset-password")
def reset_staff_password(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff = db.query(StaffMember).filter(
        StaffMember.id == staff_id,
        StaffMember.broker_id == current_user.id,
        StaffMember.is_active.is_(True),
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Active staff member not found")

    temporary_password = generate_temporary_password()
    staff.password_hash = hash_password(temporary_password)
    staff.must_change_password = True
    db.commit()

    return {
        "status": "ok",
        "message": "Password reset. Give this temporary password to the staff member. It will be replaced after their next login.",
        "staff_id": staff.id,
        "temporary_password": temporary_password,
    }
