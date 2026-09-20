import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.call import CallLog
from services.calling_service import start_calling_for_staff, stop_calling_for_staff, is_calling
import asyncio

router = APIRouter(prefix="/api/calling", tags=["calling"])

class StartCallingRequest(BaseModel):
    staff_id: int
    buffer_seconds: int = 10

class CallStatsResponse(BaseModel):
    staff_id: int
    is_calling: bool
    total_calls_today: int
    answered_calls: int
    missed_calls: int
    failed_calls: int

@router.post("/start")
async def start_calling(request: StartCallingRequest, db: Session = Depends(get_db)):
    """Start auto-dialing for a staff member"""
    try:
        if is_calling(request.staff_id):
            return {"status": "already_running", "message": f"Calling already active for staff {request.staff_id}"}
        
        # Start calling in background
        asyncio.create_task(start_calling_for_staff(db, request.staff_id, request.buffer_seconds))
        
        return {
            "status": "started",
            "message": f"Auto-dialing started for staff {request.staff_id}",
            "buffer_seconds": request.buffer_seconds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_calling(staff_id: int, db: Session = Depends(get_db)):
    """Stop auto-dialing for a staff member"""
    try:
        stop_calling_for_staff(staff_id)
        return {
            "status": "stopped",
            "message": f"Auto-dialing stopped for staff {staff_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_calling_status(staff_id: int, db: Session = Depends(get_db)):
    """Get calling status for a staff member"""
    return {
        "staff_id": staff_id,
        "is_calling": is_calling(staff_id)
    }

@router.get("/stats")
async def get_call_stats(staff_id: int, db: Session = Depends(get_db)):
    """Get call statistics for a staff member today"""
    from datetime import date
    
    today = date.today()
    
    calls = db.query(CallLog).filter(
        CallLog.staff_id == staff_id,
        CallLog.called_at >= today
    ).all()
    
    answered = len([c for c in calls if c.call_status == "answered"])
    missed = len([c for c in calls if c.call_status == "missed"])
    failed = len([c for c in calls if c.call_status == "failed"])
    
    return {
        "staff_id": staff_id,
        "is_calling": is_calling(staff_id),
        "total_calls_today": len(calls),
        "answered_calls": answered,
        "missed_calls": missed,
        "failed_calls": failed
    }

@router.get("/logs")
async def get_call_logs(staff_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Get call logs for a staff member"""
    logs = db.query(CallLog).filter(
        CallLog.staff_id == staff_id
    ).order_by(CallLog.called_at.desc()).limit(limit).all()
    
    return [
        {
            "id": log.id,
            "phone": log.contact.phone if log.contact else "N/A",
            "status": log.call_status,
            "duration": log.call_duration,
            "called_at": log.called_at
        }
        for log in logs
    ]