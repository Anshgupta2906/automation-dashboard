from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from .base import Base

class MessageContact(Base):
    __tablename__ = "message_contacts"

    id = Column(Integer, primary_key=True, index=True)
    broker_id = Column(Integer, ForeignKey("users.id"))
    phone = Column(String, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("message_contacts.id"))
    status = Column(String)  # sent, failed, pending
    channel = Column(String)  # whatsapp, sms
    sent_at = Column(DateTime, default=datetime.utcnow)