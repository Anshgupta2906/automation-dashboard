from argon2 import PasswordHasher
from sqlalchemy.orm import Session
from models.user import User
import os
from datetime import datetime, timedelta
from jose import JWTError, jwt

ph = PasswordHasher()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def hash_password(password: str) -> str:
    """Hash a password"""
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def register_user(db: Session, email: str, password: str, has_message_shooter: bool = False, has_lead_distributor: bool = False):
    """Register a new user"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return None
    
    # Create new user
    hashed_password = hash_password(password)
    new_user = User(
        email=email,
        password_hash=hashed_password,
        has_message_shooter=has_message_shooter,
        has_lead_distributor=has_lead_distributor
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def login_user(db: Session, email: str, password: str):
    """Authenticate user and return user object"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user