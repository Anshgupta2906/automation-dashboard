from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.schemas.user_schema import UserLogin, UserRegister, UserResponse
from backend.services.auth_service import create_access_token, login_user, register_user

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
        "access_token": create_access_token({"sub": str(db_user.id)}),
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "has_message_shooter": db_user.has_message_shooter,
            "has_lead_distributor": db_user.has_lead_distributor,
        },
    }


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user
