from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from models.base import Base

class CallLog(Base):
    __tablename__ = "call_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("distribution_contacts.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff_members.id"), nullable=False)
    call_status = Column(String, default="pending")
    call_duration = Column(Float, default=0)
    called_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    
    contact = relationship("DistributionContact")
    staff = relationship("StaffMember")