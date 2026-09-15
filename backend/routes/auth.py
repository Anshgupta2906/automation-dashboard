import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.schemas.user_schema import UserRegister, UserLogin, UserResponse
from backend.services.auth_service import register_user, login_user, create_access_token
from backend.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse)
def signup(user: UserRegister, db: Session = Depends(get_db)):
    """Register a new broker"""
    # Check if user already exists
    db_user = register_user(
        db,
        email=user.email,
        password=user.password,
        has_message_shooter=user.has_message_shooter,
        has_lead_distributor=user.has_lead_distributor
    )
    
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    return db_user

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    """Login broker and return JWT token"""
    db_user = login_user(db, email=user.email, password=user.password)
    
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create JWT token
    access_token = create_access_token(data={"sub": str(db_user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "has_message_shooter": db_user.has_message_shooter,
            "has_lead_distributor": db_user.has_lead_distributor
        }
    }