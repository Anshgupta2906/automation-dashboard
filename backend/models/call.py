from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base


class CallingSession(Base):
    __tablename__ = "calling_sessions"
    __table_args__ = (UniqueConstraint("staff_id", name="uq_calling_session_staff"),)

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff_members.id"), nullable=False, index=True)
    status = Column(String, default="stopped", nullable=False)  # running | paused | stopped
    buffer_seconds = Column(Integer, default=10, nullable=False)
    current_call_id = Column(Integer, ForeignKey("call_logs.id"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    staff = relationship("StaffMember")
    current_call = relationship("CallLog", foreign_keys=[current_call_id], post_update=True)


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("distribution_contacts.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff_members.id"), nullable=False, index=True)
    call_status = Column(String, default="initiated", nullable=False)
    call_duration = Column(Float, default=0, nullable=False)
    provider_call_id = Column(String, nullable=True, index=True)
    called_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    contact = relationship("DistributionContact")
    staff = relationship("StaffMember")
