from pydantic import BaseModel, EmailStr
from typing import Optional

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    has_message_shooter: bool = False
    has_lead_distributor: bool = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    has_message_shooter: bool
    has_lead_distributor: bool

    class Config:
        from_attributes = True