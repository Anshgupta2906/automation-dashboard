from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .base import Base


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("distribution_contacts.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff_members.id"), nullable=False, index=True)
    call_status = Column(String, default="pending", nullable=False)
    call_duration = Column(Float, default=0, nullable=False)
    called_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    contact = relationship("DistributionContact")
    staff = relationship("StaffMember")
