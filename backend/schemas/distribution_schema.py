from pydantic import BaseModel
from typing import Optional
from datetime import date

class StaffMemberCreate(BaseModel):
    name: str
    email: str

class StaffMemberResponse(BaseModel):
    id: int
    name: str
    email: str

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
    contacts_per_person: int  # 300
    selected_days: list  # ["monday", "tuesday", "wednesday", ...]
    send_time: str  # "08:00" format
    enabled: bool = True
    exclusion_window: int = 0  # 0 means no exclusion (fresh pool daily)

class DistributionHistoryResponse(BaseModel):
    id: int
    contact_id: int
    staff_id: int
    assigned_date: date

    class Config:
        from_attributes = True