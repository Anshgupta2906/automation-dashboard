from pydantic import BaseModel
from typing import Optional

class MessageContactCreate(BaseModel):
    phone: str
    name: Optional[str] = None

class MessageContactResponse(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None

    class Config:
        from_attributes = True

class MessageSchedule(BaseModel):
    message: str
    send_time: str  # "09:00" format (24-hour format)
    enabled: bool = True
    selected_days: list  # ["monday", "wednesday", "friday", "sunday"]