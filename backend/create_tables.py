import sys
import os

# Add backend to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from models.base import Base
from models.user import User
from models.message import MessageContact, MessageLog
from models.distribution import DistributionContact, StaffMember, DistributionHistory
from database import engine

# Create all tables
Base.metadata.create_all(bind=engine)

print("✅ All tables created successfully!")