from datetime import date, datetime

from sqlalchemy.orm import Session

from backend.models.call import CallLog, CallingSession
from backend.models.distribution import DistributionContact, DistributionHistory, StaffMember


TERMINAL_STATUSES = {"answered", "completed", "missed", "failed", "no_answer", "busy", "cancelled"}


def get_or_create_session(db: Session, staff_id: int) -> CallingSession:
    session = db.query(CallingSession).filter(CallingSession.staff_id == staff_id).first()
    if session:
        return session
    session = CallingSession(staff_id=staff_id, status="stopped", buffer_seconds=10)
    db.add(session)
    db.flush()
    return session


def start_queue_for_staff(db: Session, staff_id: int, buffer_seconds: int = 10) -> CallingSession:
    session = get_or_create_session(db, staff_id)
    session.status = "running"
    session.buffer_seconds = buffer_seconds
    session.started_at = session.started_at or datetime.utcnow()
    session.paused_at = None
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


def pause_queue_for_staff(db: Session, staff_id: int) -> CallingSession:
    session = get_or_create_session(db, staff_id)
    session.status = "paused"
    session.paused_at = datetime.utcnow()
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


def stop_queue_for_staff(db: Session, staff_id: int) -> CallingSession:
    session = get_or_create_session(db, staff_id)
    session.status = "stopped"
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


def is_calling(db: Session, staff_id: int) -> bool:
    session = get_or_create_session(db, staff_id)
    return session.status == "running"


def get_session_status(db: Session, staff_id: int) -> CallingSession:
    return get_or_create_session(db, staff_id)


def _called_contact_subquery(db: Session, staff_id: int):
    return db.query(CallLog.contact_id).filter(CallLog.staff_id == staff_id)


def get_remaining_count(db: Session, staff_id: int) -> int:
    today = date.today()
    called_contact_ids = _called_contact_subquery(db, staff_id).filter(
        CallLog.called_at >= today,
    )
    return (
        db.query(DistributionHistory.contact_id)
        .filter(
            DistributionHistory.staff_id == staff_id,
            DistributionHistory.assigned_date == today,
            ~DistributionHistory.contact_id.in_(called_contact_ids),
        )
        .count()
    )


def get_next_contact(db: Session, staff_id: int):
    today = date.today()
    called_subquery = _called_contact_subquery(db, staff_id).filter(CallLog.called_at >= today)

    return (
        db.query(DistributionContact)
        .join(DistributionHistory, DistributionHistory.contact_id == DistributionContact.id)
        .filter(
            DistributionHistory.staff_id == staff_id,
            DistributionHistory.assigned_date == today,
            ~DistributionContact.id.in_(called_subquery),
        )
        .order_by(DistributionHistory.id)
        .first()
    )


def claim_next_call(db: Session, staff_id: int) -> CallLog | None:
    """Atomically reserve the next unattempted lead for a calling session."""
    session = get_or_create_session(db, staff_id)
    if session.status != "running":
        return None

    contact = get_next_contact(db, staff_id)
    if not contact:
        return None

    log = CallLog(
        contact_id=contact.id,
        staff_id=staff_id,
        call_status="initiated",
        call_duration=0,
        called_at=datetime.utcnow(),
    )
    db.add(log)
    db.flush()

    session.current_call_id = log.id
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(log)
    return log


def record_call(
    db: Session,
    staff_id: int,
    contact_id: int,
    call_status: str,
    duration: float = 0,
    call_id: int | None = None,
    provider_call_id: str | None = None,
) -> CallLog:
    allowed = TERMINAL_STATUSES | {"initiated", "ringing", "in_progress"}
    if call_status not in allowed:
        raise ValueError("Invalid call status")

    log = None
    if call_id:
        log = db.query(CallLog).filter(
            CallLog.id == call_id,
            CallLog.staff_id == staff_id,
            CallLog.contact_id == contact_id,
        ).first()

    if log is None:
        contact = (
            db.query(DistributionContact)
            .join(DistributionHistory, DistributionHistory.contact_id == DistributionContact.id)
            .filter(
                DistributionContact.id == contact_id,
                DistributionHistory.staff_id == staff_id,
                DistributionHistory.assigned_date == date.today(),
            )
            .first()
        )
        if not contact:
            raise ValueError("Contact is not assigned to this staff member today")
        log = CallLog(
            contact_id=contact_id,
            staff_id=staff_id,
            called_at=datetime.utcnow(),
        )
        db.add(log)

    log.call_status = call_status
    log.call_duration = max(0, duration)
    if provider_call_id:
        log.provider_call_id = provider_call_id
    if call_status in TERMINAL_STATUSES:
        log.ended_at = datetime.utcnow()

    session = get_or_create_session(db, staff_id)
    if session.current_call_id == log.id and call_status in TERMINAL_STATUSES:
        session.current_call_id = None
        session.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(log)
    return log
