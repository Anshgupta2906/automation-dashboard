from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    has_message_shooter: bool = False
    has_lead_distributor: bool = False


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AccountDeleteRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    has_message_shooter: bool
    has_lead_distributor: bool
    plan: str = "none"
    subscription_status: str = "active"

    class Config:
        from_attributes = True
