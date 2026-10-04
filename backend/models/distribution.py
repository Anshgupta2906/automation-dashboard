from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Boolean, Index

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
    password_hash = Column(String, nullable=True)
    must_change_password = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DistributionConfig(Base):
    __tablename__ = "distribution_configs"

    id = Column(Integer, primary_key=True, index=True)
    broker_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    contacts_per_person = Column(Integer, default=300, nullable=False)
    selected_days = Column(String, default="monday,tuesday,wednesday,thursday,friday,saturday", nullable=False)
    send_time = Column(String, default="08:00", nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DistributionHistory(Base):
    __tablename__ = "distribution_history"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("distribution_contacts.id"))
    staff_id = Column(Integer, ForeignKey("staff_members.id"))
    assigned_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_distribution_history_staff_contact", "staff_id", "contact_id"),
        Index("ix_distribution_history_staff_date", "staff_id", "assigned_date"),
    )
