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
        is_active=True,
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff
