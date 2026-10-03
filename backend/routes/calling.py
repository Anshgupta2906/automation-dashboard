from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models.call import CallLog
from backend.models.distribution import StaffMember
from backend.models.user import User
from backend.services.calling_service import (
    claim_next_call,
    get_next_contact,
    get_remaining_count,
    get_session_status,
    is_calling,
    pause_queue_for_staff,
    record_call,
    start_queue_for_staff,
    stop_queue_for_staff,
)

router = APIRouter(prefix="/api/calling", tags=["calling"])


class StartCallingRequest(BaseModel):
    staff_id: int
    buffer_seconds: int = Field(default=10, ge=1, le=300)


class CompleteCallRequest(BaseModel):
    staff_id: int
    contact_id: int
    status: str
    duration: float = Field(default=0, ge=0, le=86400)
    call_id: int | None = None
    provider_call_id: str | None = None


class PauseCallingRequest(BaseModel):
    staff_id: int


def get_owned_staff(db: Session, current_user: User, staff_id: int) -> StaffMember:
    staff = db.query(StaffMember).filter(
        StaffMember.id == staff_id,
        StaffMember.broker_id == current_user.id,
        StaffMember.is_active.is_(True),
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


def session_payload(db: Session, staff_id: int) -> dict:
    session = get_session_status(db, staff_id)
    return {
        "staff_id": staff_id,
        "status": session.status,
        "is_calling": session.status == "running",
        "buffer_seconds": session.buffer_seconds,
        "current_call_id": session.current_call_id,
        "remaining": get_remaining_count(db, staff_id),
    }


@router.post("/start")
def start_calling(
    request: StartCallingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, request.staff_id)
    session = start_queue_for_staff(db, request.staff_id, request.buffer_seconds)
    next_contact = get_next_contact(db, request.staff_id)
    return {
        "status": "started",
        "message": "Calling session started. The telephony adapter can now claim and dial the next lead.",
        "session_status": session.status,
        "buffer_seconds": session.buffer_seconds,
        "remaining": get_remaining_count(db, request.staff_id),
        "next_contact": (
            {"id": next_contact.id, "name": next_contact.name, "phone": next_contact.phone}
            if next_contact else None
        ),
    }


@router.post("/pause")
def pause_calling(
    request: PauseCallingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, request.staff_id)
    session = pause_queue_for_staff(db, request.staff_id)
    return session_payload(db, request.staff_id) | {"message": "Calling session paused. No new call will be claimed until resume."}


@router.post("/resume")
def resume_calling(
    request: StartCallingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, request.staff_id)
    session = start_queue_for_staff(db, request.staff_id, request.buffer_seconds)
    next_contact = get_next_contact(db, request.staff_id)
    return {
        "status": "resumed",
        "session_status": session.status,
        "buffer_seconds": session.buffer_seconds,
        "remaining": get_remaining_count(db, request.staff_id),
        "next_contact": (
            {"id": next_contact.id, "name": next_contact.name, "phone": next_contact.phone}
            if next_contact else None
        ),
    }


@router.post("/stop")
def stop_calling(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    stop_queue_for_staff(db, staff_id)
    return session_payload(db, staff_id) | {"message": "Calling session stopped."}


@router.post("/claim-next")
def claim_next(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reserve one lead for the telephony provider before it places the call."""
    get_owned_staff(db, current_user, staff_id)
    log = claim_next_call(db, staff_id)
    if not log:
        session = get_session_status(db, staff_id)
        if session.status != "running":
            raise HTTPException(status_code=409, detail="Calling session is not running")
        return {"status": "empty", "message": "No uncalled leads remain for today", "remaining": 0}

    return {
        "status": "claimed",
        "call_id": log.id,
        "contact": {
            "id": log.contact.id,
            "name": log.contact.name,
            "phone": log.contact.phone,
        },
        "buffer_seconds": get_session_status(db, staff_id).buffer_seconds,
        "remaining": get_remaining_count(db, staff_id),
    }


@router.get("/next")
def next_call(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    contact = get_next_contact(db, staff_id)
    if not contact:
        return {"status": "empty", "message": "No uncalled leads remain for today"}

    return {
        "status": "ready",
        "contact": {"id": contact.id, "name": contact.name, "phone": contact.phone},
    }


@router.post("/complete")
def complete_call(
    request: CompleteCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, request.staff_id)
    try:
        log = record_call(
            db,
            request.staff_id,
            request.contact_id,
            request.status,
            request.duration,
            request.call_id,
            request.provider_call_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "status": "recorded",
        "call_id": log.id,
        "remaining": get_remaining_count(db, request.staff_id),
        "session": session_payload(db, request.staff_id),
    }


@router.get("/status")
def get_calling_status(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    return session_payload(db, staff_id)


@router.get("/stats")
def get_call_stats(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    calls = db.query(CallLog).filter(
        CallLog.staff_id == staff_id,
        CallLog.called_at >= date.today(),
    ).all()

    return {
        "staff_id": staff_id,
        "status": get_session_status(db, staff_id).status,
        "is_calling": is_calling(db, staff_id),
        "total_calls_today": len(calls),
        "answered_calls": sum(c.call_status in {"answered", "completed"} for c in calls),
        "missed_calls": sum(c.call_status in {"missed", "no_answer"} for c in calls),
        "failed_calls": sum(c.call_status in {"failed", "busy", "cancelled"} for c in calls),
        "remaining": get_remaining_count(db, staff_id),
    }


@router.get("/logs")
def get_call_logs(
    staff_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    limit = min(max(limit, 1), 200)
    logs = (
        db.query(CallLog)
        .filter(CallLog.staff_id == staff_id)
        .order_by(CallLog.called_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "phone": log.contact.phone if log.contact else "N/A",
            "status": log.call_status,
            "duration": log.call_duration,
            "provider_call_id": log.provider_call_id,
            "called_at": log.called_at,
            "ended_at": log.ended_at,
        }
        for log in logs
    ]
