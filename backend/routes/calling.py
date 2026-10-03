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
    get_next_contact,
    get_remaining_count,
    is_calling,
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


def get_owned_staff(db: Session, current_user: User, staff_id: int) -> StaffMember:
    staff = db.query(StaffMember).filter(
        StaffMember.id == staff_id,
        StaffMember.broker_id == current_user.id,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


@router.post("/start")
def start_calling(
    request: StartCallingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, request.staff_id)
    remaining = start_queue_for_staff(db, request.staff_id)
    return {
        "status": "started",
        "mode": "manual_provider_pending",
        "message": "Call queue started. Connect a telephony provider later to automate dialing.",
        "remaining": remaining,
        "buffer_seconds": request.buffer_seconds,
    }


@router.post("/stop")
def stop_calling(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    stop_queue_for_staff(staff_id)
    return {"status": "stopped", "staff_id": staff_id}


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
        "contact": {
            "id": contact.id,
            "name": contact.name,
            "phone": contact.phone,
        },
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
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "status": "recorded",
        "call_id": log.id,
        "remaining": get_remaining_count(db, request.staff_id),
    }


@router.get("/status")
def get_calling_status(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_staff(db, current_user, staff_id)
    return {
        "staff_id": staff_id,
        "is_calling": is_calling(staff_id),
        "remaining": get_remaining_count(db, staff_id),
    }


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
        "is_calling": is_calling(staff_id),
        "total_calls_today": len(calls),
        "answered_calls": sum(c.call_status == "answered" for c in calls),
        "missed_calls": sum(c.call_status in {"missed", "no_answer"} for c in calls),
        "failed_calls": sum(c.call_status in {"failed", "busy"} for c in calls),
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
            "called_at": log.called_at,
        }
        for log in logs
    ]
