from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class StaffMemberCreate(BaseModel):
    name: str
    email: EmailStr


class StaffMemberUpdate(BaseModel):
    name: str
    email: EmailStr


class StaffMemberResponse(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool = True

    class Config:
        from_attributes = True


class DistributionContactCreate(BaseModel):
    phone: str
    name: Optional[str] = None


class DistributionContactResponse(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None

    class Config:
        from_attributes = True


class DistributionConfig(BaseModel):
    contacts_per_person: int
    selected_days: list
    send_time: str
    enabled: bool = True
    exclusion_window: int = 0


class DistributionHistoryResponse(BaseModel):
    id: int
    contact_id: int
    staff_id: int
    assigned_date: date

    class Config:
        from_attributes = True
