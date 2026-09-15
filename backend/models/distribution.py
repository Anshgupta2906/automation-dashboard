from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from datetime import datetime
from .base import Base

class DistributionContact(Base):
    __tablename__ = "distribution_contacts"

    id = Column(Integer, primary_key=True, index=True)
    broker_id = Column(Integer, ForeignKey("users.id"))
    phone = Column(String, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class StaffMember(Base):
    __tablename__ = "staff_members"

    id = Column(Integer, primary_key=True, index=True)
    broker_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class DistributionHistory(Base):
    __tablename__ = "distribution_history"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("distribution_contacts.id"))
    staff_id = Column(Integer, ForeignKey("staff_members.id"))
    assigned_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)