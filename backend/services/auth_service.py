import os
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from jose import jwt
from sqlalchemy.orm import Session

from backend.models.user import User

ph = PasswordHasher()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, plain_password)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured")
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def register_user(
    db: Session,
    email: str,
    password: str,
    has_message_shooter: bool = False,
    has_lead_distributor: bool = False,
):
    normalized_email = email.strip().lower()
    if db.query(User).filter(User.email == normalized_email).first():
        return None

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        has_message_shooter=has_message_shooter,
        has_lead_distributor=has_lead_distributor,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, email: str, password: str):
    normalized_email = email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
