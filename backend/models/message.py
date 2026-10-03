from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from .base import Base


class MessageContact(Base):
    __tablename__ = "message_contacts"

    id = Column(Integer, primary_key=True, index=True)
    broker_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    phone = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MessageCampaign(Base):
    __tablename__ = "message_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    broker_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    channel = Column(String, default="whatsapp", nullable=False)
    send_time = Column(String, nullable=False)
    selected_days = Column(String, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("message_contacts.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("message_campaigns.id"), nullable=True)
    status = Column(String, nullable=False)  # queued, sent, failed
    channel = Column(String, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
