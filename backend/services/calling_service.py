from datetime import date

from sqlalchemy.orm import Session

from backend.models.call import CallLog
from backend.models.distribution import DistributionContact, DistributionHistory, StaffMember

active_call_queues: set[int] = set()


def start_queue_for_staff(db: Session, staff_id: int) -> int:
    active_call_queues.add(staff_id)
    return get_remaining_count(db, staff_id)


def stop_queue_for_staff(staff_id: int) -> None:
    active_call_queues.discard(staff_id)


def is_calling(staff_id: int) -> bool:
    return staff_id in active_call_queues


def get_remaining_count(db: Session, staff_id: int) -> int:
    today = date.today()
    called_contact_ids = {
        contact_id for (contact_id,) in db.query(CallLog.contact_id).filter(
            CallLog.staff_id == staff_id,
            CallLog.called_at >= today,
        ).all()
    }

    query = (
        db.query(DistributionHistory.contact_id)
        .filter(
            DistributionHistory.staff_id == staff_id,
            DistributionHistory.assigned_date == today,
        )
    )
    if called_contact_ids:
        query = query.filter(~DistributionHistory.contact_id.in_(called_contact_ids))
    return query.count()


def get_next_contact(db: Session, staff_id: int):
    today = date.today()
    called_subquery = db.query(CallLog.contact_id).filter(
        CallLog.staff_id == staff_id,
        CallLog.called_at >= today,
    )

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


def record_call(
    db: Session,
    staff_id: int,
    contact_id: int,
    call_status: str,
    duration: float = 0,
) -> CallLog:
    allowed = {"answered", "missed", "failed", "no_answer", "busy"}
    if call_status not in allowed:
        raise ValueError("Invalid call status")

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
        call_status=call_status,
        call_duration=max(0, duration),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
