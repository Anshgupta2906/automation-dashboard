import csv
import io
import re
from datetime import date
from pathlib import Path

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import EmailStr
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models.distribution import DistributionContact, DistributionHistory, StaffMember
from backend.models.user import User
from backend.schemas.distribution_schema import DistributionConfig, StaffMemberCreate, StaffMemberResponse
from backend.services.email_service import send_leads_email

router = APIRouter(prefix="/api/lead-distributor", tags=["lead-distributor"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
DEFAULT_CONTACTS_PER_PERSON = 300


def require_feature(current_user: User) -> None:
    if not current_user.has_lead_distributor:
        raise HTTPException(status_code=403, detail="Lead Distributor is not enabled for this account")


def normalize_phone(value) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if not 7 <= len(digits) <= 15:
        return None
    return digits


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

    text = contents.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
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
    require_feature(current_user)

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large. Maximum size is 50 MB.")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".csv", ".xlsx"}:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported.")

    try:
        existing = {
            phone for (phone,) in db.query(DistributionContact.phone)
            .filter(DistributionContact.broker_id == current_user.id)
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
            batch.append({
                "broker_id": current_user.id,
                "phone": phone,
                "name": name,
            })
            if len(batch) >= 1000:
                db.bulk_insert_mappings(DistributionContact, batch)
                added += len(batch)
                batch.clear()

        if batch:
            db.bulk_insert_mappings(DistributionContact, batch)
            added += len(batch)

        db.commit()
        return {
            "status": "success",
            "contacts_added": added,
            "duplicates_skipped": duplicates,
            "message": f"Successfully imported {added} contacts",
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error processing file: {exc}")


@router.post("/staff", response_model=StaffMemberResponse, status_code=status.HTTP_201_CREATED)
def add_staff_member(
    staff: StaffMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    email = str(staff.email).strip().lower()
    if db.query(StaffMember).filter(
        StaffMember.broker_id == current_user.id,
        func.lower(StaffMember.email) == email,
    ).first():
        raise HTTPException(status_code=409, detail="A staff member with this email already exists")

    new_staff = StaffMember(
        broker_id=current_user.id,
        name=staff.name.strip(),
        email=email,
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


@router.get("/staff")
def get_staff_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    return db.query(StaffMember).filter(StaffMember.broker_id == current_user.id).order_by(StaffMember.id).all()


@router.post("/configure")
def configure_distribution(
    config: DistributionConfig,
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    if not 1 <= config.contacts_per_person <= 5000:
        raise HTTPException(status_code=400, detail="contacts_per_person must be between 1 and 5000")
    if not config.selected_days:
        raise HTTPException(status_code=400, detail="Select at least one day")
    return {"status": "success", "message": "Configuration accepted", "config": config}


@router.post("/distribute-now")
def distribute_leads_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)

    staff_members = db.query(StaffMember).filter(StaffMember.broker_id == current_user.id).all()
    if not staff_members:
        raise HTTPException(status_code=400, detail="No staff members configured")

    today = date.today()
    total_distributed = 0

    try:
        for staff in staff_members:
            assigned_today = db.query(DistributionHistory).filter(
                DistributionHistory.staff_id == staff.id,
                DistributionHistory.assigned_date == today,
            ).count()

            capacity = max(0, DEFAULT_CONTACTS_PER_PERSON - assigned_today)
            if capacity == 0:
                continue

            contacts = (
                db.query(DistributionContact)
                .outerjoin(
                    DistributionHistory,
                    and_(
                        DistributionHistory.contact_id == DistributionContact.id,
                        DistributionHistory.assigned_date == today,
                    ),
                )
                .filter(
                    DistributionContact.broker_id == current_user.id,
                    DistributionHistory.id.is_(None),
                )
                .order_by(DistributionContact.id)
                .limit(capacity)
                .all()
            )

            for contact in contacts:
                db.add(DistributionHistory(
                    contact_id=contact.id,
                    staff_id=staff.id,
                    assigned_date=today,
                ))
            total_distributed += len(contacts)
            db.flush()

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lead distribution failed; no changes were saved")

    return {
        "status": "success",
        "total_distributed": total_distributed,
        "staff_count": len(staff_members),
        "per_staff_capacity": DEFAULT_CONTACTS_PER_PERSON,
    }


@router.get("/history")
def get_distribution_history(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    limit = min(max(limit, 1), 500)
    offset = max(offset, 0)

    return (
        db.query(DistributionHistory)
        .join(StaffMember, StaffMember.id == DistributionHistory.staff_id)
        .filter(StaffMember.broker_id == current_user.id)
        .order_by(DistributionHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    staff_count = db.query(StaffMember).filter(StaffMember.broker_id == current_user.id).count()
    total_contacts = db.query(DistributionContact).filter(DistributionContact.broker_id == current_user.id).count()
    today_distributed = (
        db.query(DistributionHistory)
        .join(StaffMember, StaffMember.id == DistributionHistory.staff_id)
        .filter(
            StaffMember.broker_id == current_user.id,
            DistributionHistory.assigned_date == date.today(),
        )
        .count()
    )
    return {
        "total_contacts": total_contacts,
        "staff_count": staff_count,
        "distributed_today": today_distributed,
    }


@router.post("/send-emails")
def send_emails_to_staff(
    staff_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    query = db.query(StaffMember).filter(StaffMember.broker_id == current_user.id)
    if staff_id is not None:
        query = query.filter(StaffMember.id == staff_id)
    staff_list = query.all()

    sent_count = 0
    failed_count = 0
    today = date.today()

    for staff in staff_list:
        history = db.query(DistributionHistory).filter(
            DistributionHistory.staff_id == staff.id,
            DistributionHistory.assigned_date == today,
        ).all()
        if not history:
            continue

        contact_ids = [item.contact_id for item in history]
        contacts = db.query(DistributionContact).filter(
            DistributionContact.broker_id == current_user.id,
            DistributionContact.id.in_(contact_ids),
        ).all()
        payload = [{"phone": c.phone, "name": c.name or "N/A"} for c in contacts]

        if send_leads_email(staff.email, staff.name, payload):
            sent_count += 1
        else:
            failed_count += 1

    return {
        "status": "success",
        "emails_sent": sent_count,
        "emails_failed": failed_count,
    }
