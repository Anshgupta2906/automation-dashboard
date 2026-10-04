from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import get_current_staff
from backend.database import get_db
from backend.models.call import CallLog
from backend.models.distribution import StaffMember
from backend.services.calling_service import (
    claim_next_call,
    get_next_contact,
    get_remaining_count,
    get_session_status,
    pause_queue_for_staff,
    record_call,
    start_queue_for_staff,
    stop_queue_for_staff,
)

router = APIRouter(prefix="/api/staff-calling", tags=["staff-calling"])


class StartRequest(BaseModel):
    buffer_seconds: int = Field(default=7, ge=1, le=300)


class CompleteRequest(BaseModel):
    contact_id: int
    status: str
    duration: float = Field(default=0, ge=0, le=86400)
    call_id: int | None = None


def payload(db: Session, staff_id: int) -> dict:
    session = get_session_status(db, staff_id)
    return {
        "staff_id": staff_id,
        "status": session.status,
        "buffer_seconds": session.buffer_seconds,
        "remaining": get_remaining_count(db, staff_id),
        "current_call_id": session.current_call_id,
    }


@router.get("/me")
def me(current_staff: StaffMember = Depends(get_current_staff)):
    return {
        "id": current_staff.id,
        "name": current_staff.name,
        "email": current_staff.email,
        "broker_id": current_staff.broker_id,
        "must_change_password": current_staff.must_change_password,
    }


@router.get("/status")
def status(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    return payload(db, current_staff.id)


@router.post("/start")
def start(
    request: StartRequest,
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    session = start_queue_for_staff(db, current_staff.id, request.buffer_seconds)
    next_contact = get_next_contact(db, current_staff.id)
    return {
        **payload(db, current_staff.id),
        "message": "Calling queue started.",
        "next_contact": (
            {"id": next_contact.id, "name": next_contact.name, "phone": next_contact.phone}
            if next_contact else None
        ),
    }


@router.post("/pause")
def pause(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    pause_queue_for_staff(db, current_staff.id)
    return {**payload(db, current_staff.id), "message": "Calling queue paused."}


@router.post("/resume")
def resume(
    request: StartRequest,
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    start_queue_for_staff(db, current_staff.id, request.buffer_seconds)
    return {**payload(db, current_staff.id), "message": "Calling queue resumed."}


@router.post("/stop")
def stop(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    stop_queue_for_staff(db, current_staff.id)
    return {**payload(db, current_staff.id), "message": "Calling queue stopped."}


@router.post("/claim-next")
def claim_next(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    log = claim_next_call(db, current_staff.id)
    if not log:
        session = get_session_status(db, current_staff.id)
        if session.status != "running":
            raise HTTPException(status_code=409, detail="Start the calling queue first")
        return {"status": "empty", "message": "No uncalled leads remain for today", "remaining": 0}

    return {
        "status": "claimed",
        "call_id": log.id,
        "contact": {
            "id": log.contact.id,
            "name": log.contact.name,
            "phone": log.contact.phone,
        },
        "remaining": get_remaining_count(db, current_staff.id),
    }


@router.get("/next")
def next_lead(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    contact = get_next_contact(db, current_staff.id)
    if not contact:
        return {"status": "empty", "message": "No uncalled leads remain for today"}
    return {
        "status": "ready",
        "contact": {"id": contact.id, "name": contact.name, "phone": contact.phone},
    }


@router.post("/complete")
def complete(
    request: CompleteRequest,
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    try:
        log = record_call(
            db,
            current_staff.id,
            request.contact_id,
            request.status,
            request.duration,
            request.call_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "status": "recorded",
        "call_id": log.id,
        "remaining": get_remaining_count(db, current_staff.id),
    }


@router.get("/stats")
def stats(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    calls = db.query(CallLog).filter(
        CallLog.staff_id == current_staff.id,
        CallLog.called_at >= date.today(),
    ).all()

    return {
        "total_calls_today": len(calls),
        "answered_calls": sum(c.call_status in {"answered", "completed"} for c in calls),
        "missed_calls": sum(c.call_status in {"missed", "no_answer"} for c in calls),
        "failed_calls": sum(c.call_status in {"failed", "busy", "cancelled"} for c in calls),
        "remaining": get_remaining_count(db, current_staff.id),
    }


@router.get("/logs")
def logs(
    db: Session = Depends(get_db),
    current_staff: StaffMember = Depends(get_current_staff),
):
    rows = (
        db.query(CallLog)
        .filter(CallLog.staff_id == current_staff.id)
        .order_by(CallLog.called_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": row.id,
            "phone": row.contact.phone if row.contact else "N/A",
            "status": row.call_status,
            "duration": row.call_duration,
            "called_at": row.called_at,
            "ended_at": row.ended_at,
        }
        for row in rows
    ]
