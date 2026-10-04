import csv
import io
import re
from pathlib import Path

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_subscription_feature
from backend.database import get_db
from backend.models.message import MessageCampaign, MessageContact, MessageLog
from backend.models.user import User
from backend.schemas.message_schema import MessageSchedule

router = APIRouter(prefix="/api/message-shooter", tags=["message-shooter"])
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def require_feature(db: Session, current_user: User) -> None:
    require_subscription_feature(db, current_user, "message_shooter")


def normalize_phone(value) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits if 7 <= len(digits) <= 15 else None


def parse_rows(contents: bytes, filename: str):
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".xlsx":
        workbook = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
        sheet = workbook.active
        rows = sheet.iter_rows(values_only=True)
        try:
            headers = [str(v).strip().lower() if v is not None else "" for v in next(rows)]
        except StopIteration:
            return
        phone_index = next((i for i, h in enumerate(headers) if h in {"phone", "mobile", "mobile_number", "phone_number"}), 0)
        name_index = next((i for i, h in enumerate(headers) if h in {"name", "full_name"}), None)
        for row in rows:
            phone = normalize_phone(row[phone_index] if phone_index < len(row) else None)
            name = str(row[name_index]).strip() if name_index is not None and name_index < len(row) and row[name_index] else None
            if phone:
                yield phone, name
        return

    reader = csv.DictReader(io.StringIO(contents.decode("utf-8-sig")))
    for row in reader:
        phone_value = next((row.get(k) for k in ("phone", "Phone", "mobile", "Mobile", "phone_number") if row.get(k)), None)
        name = next((row.get(k) for k in ("name", "Name", "full_name") if row.get(k)), None)
        phone = normalize_phone(phone_value)
        if phone:
            yield phone, name


@router.post("/upload")
async def upload_contacts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(db, current_user)
    contents = await file.read()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large. Maximum size is 50 MB.")
    if Path(file.filename or "").suffix.lower() not in {".csv", ".xlsx"}:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported.")

    try:
        existing = {
            phone for (phone,) in db.query(MessageContact.phone)
            .filter(MessageContact.broker_id == current_user.id)
            .all()
        }
        seen = set(existing)
        batch = []
        added = 0
        duplicates = 0

        for phone, name in parse_rows(contents, file.filename):
            if phone in seen:
                duplicates += 1
                continue
            seen.add(phone)
            batch.append({"broker_id": current_user.id, "phone": phone, "name": name})
            if len(batch) >= 1000:
                db.bulk_insert_mappings(MessageContact, batch)
                added += len(batch)
                batch.clear()

        if batch:
            db.bulk_insert_mappings(MessageContact, batch)
            added += len(batch)

        db.commit()
        return {"status": "success", "contacts_added": added, "duplicates_skipped": duplicates}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error processing file: {exc}")


@router.post("/schedule", status_code=201)
def schedule_message(
    schedule: MessageSchedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(db, current_user)

    if not schedule.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if not schedule.selected_days:
        raise HTTPException(status_code=400, detail="Select at least one day")

    campaign = MessageCampaign(
        broker_id=current_user.id,
        message=schedule.message.strip(),
        channel="whatsapp",
        send_time=schedule.send_time,
        selected_days=",".join(day.lower() for day in schedule.selected_days),
        enabled=schedule.enabled,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return {
        "status": "success",
        "campaign_id": campaign.id,
        "message": "Campaign scheduled. Messages will enter the provider queue at the configured time.",
    }


@router.get("/campaigns")
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(db, current_user)
    campaigns = (
        db.query(MessageCampaign)
        .filter(MessageCampaign.broker_id == current_user.id)
        .order_by(MessageCampaign.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "message": c.message,
            "channel": c.channel,
            "send_time": c.send_time,
            "selected_days": c.selected_days.split(","),
            "enabled": c.enabled,
            "created_at": c.created_at,
        }
        for c in campaigns
    ]


@router.get("/stats")
def message_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(db, current_user)
    contact_count = db.query(MessageContact).filter(MessageContact.broker_id == current_user.id).count()
    campaign_count = db.query(MessageCampaign).filter(MessageCampaign.broker_id == current_user.id).count()
    queued_count = (
        db.query(MessageLog)
        .join(MessageContact, MessageContact.id == MessageLog.contact_id)
        .filter(MessageContact.broker_id == current_user.id, MessageLog.status == "queued")
        .count()
    )
    return {
        "contacts": contact_count,
        "campaigns": campaign_count,
        "queued_messages": queued_count,
    }
