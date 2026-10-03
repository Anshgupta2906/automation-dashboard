import csv
import io
import re
from datetime import date
from pathlib import Path

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models.distribution import (
    DistributionConfig as DistributionConfigModel,
    DistributionContact,
    DistributionHistory,
    StaffMember,
)
from backend.models.user import User
from backend.schemas.distribution_schema import (
    DistributionConfig,
    StaffMemberCreate,
    StaffMemberResponse,
    StaffMemberUpdate,
)
from backend.services.email_service import send_leads_email

router = APIRouter(prefix="/api/lead-distributor", tags=["lead-distributor"])

MAX_UPLOAD_BYTES = 200 * 1024 * 1024
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


def _header_index(headers, candidates):
    return next((i for i, header in enumerate(headers) if header in candidates), None)


def _is_header_row(values) -> bool:
    headers = {str(v).strip().lower() for v in values if v is not None and str(v).strip()}
    known_headers = {
        "phone", "mobile", "mobile_number", "phone_number", "telephone",
        "contact", "contact_number", "name", "full_name",
    }
    return bool(headers & known_headers)


def _find_phone_index(row) -> int | None:
    for index, value in enumerate(row):
        if normalize_phone(value):
            return index
    return None


def _parse_tabular_rows(rows):
    rows = [tuple(row) for row in rows if any(value is not None and str(value).strip() for value in row)]
    if not rows:
        return

    first_row = rows[0]
    if _is_header_row(first_row):
        headers = [str(v).strip().lower() if v is not None else "" for v in first_row]
        phone_index = _header_index(
            headers,
            {"phone", "mobile", "mobile_number", "phone_number", "telephone", "contact", "contact_number"},
        )
        name_index = _header_index(headers, {"name", "full_name"})
        data_rows = rows[1:]

        if phone_index is None and data_rows:
            phone_index = _find_phone_index(data_rows[0])

        for row in data_rows:
            if phone_index is not None and phone_index < len(row):
                phone = normalize_phone(row[phone_index])
                name = None
                if name_index is not None and name_index < len(row) and row[name_index] is not None:
                    name = str(row[name_index]).strip() or None
                if phone:
                    yield phone, name
        return

    for row in rows:
        phone_index = _find_phone_index(row)
        if phone_index is None:
            continue
        phone = normalize_phone(row[phone_index])
        name = None
        for index, value in enumerate(row):
            if index != phone_index and value is not None and str(value).strip():
                name = str(value).strip()
                break
        if phone:
            yield phone, name


def parse_rows(contents: bytes, filename: str):
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".xlsx":
        workbook = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
        try:
            sheet = workbook.active
            yield from _parse_tabular_rows(sheet.iter_rows(values_only=True))
        finally:
            workbook.close()
        return

    text = contents.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    yield from _parse_tabular_rows(reader)


def _get_config(db: Session, broker_id: int) -> DistributionConfigModel | None:
    return db.query(DistributionConfigModel).filter(
        DistributionConfigModel.broker_id == broker_id
    ).first()


def _contacts_for_staff(db: Session, broker_id: int, staff_id: int, capacity: int):
    if capacity <= 0:
        return []

    already_assigned = db.query(DistributionHistory.contact_id).filter(
        DistributionHistory.staff_id == staff_id
    ).subquery()

    return (
        db.query(DistributionContact)
        .filter(
            DistributionContact.broker_id == broker_id,
            ~DistributionContact.id.in_(already_assigned),
        )
        .order_by(func.random())
        .limit(capacity)
        .all()
    )


def distribute_for_broker(db: Session, broker_id: int, contacts_per_person: int) -> dict:
    staff_members = db.query(StaffMember).filter(
        StaffMember.broker_id == broker_id,
        StaffMember.is_active.is_(True),
    ).order_by(StaffMember.id).all()

    if not staff_members:
        return {
            "total_distributed": 0,
            "staff_count": 0,
            "per_staff_capacity": contacts_per_person,
            "staff_results": [],
        }

    today = date.today()
    total_distributed = 0
    staff_results = []

    for staff in staff_members:
        assigned_today = db.query(DistributionHistory).filter(
            DistributionHistory.staff_id == staff.id,
            DistributionHistory.assigned_date == today,
        ).count()

        capacity = max(0, contacts_per_person - assigned_today)
        contacts = _contacts_for_staff(db, broker_id, staff.id, capacity)

        for contact in contacts:
            db.add(DistributionHistory(
                contact_id=contact.id,
                staff_id=staff.id,
                assigned_date=today,
            ))

        db.flush()
        count = len(contacts)
        total_distributed += count
        staff_results.append({
            "staff_id": staff.id,
            "staff_name": staff.name,
            "contacts_assigned": count,
        })

    return {
        "total_distributed": total_distributed,
        "staff_count": len(staff_members),
        "per_staff_capacity": contacts_per_person,
        "staff_results": staff_results,
    }


@router.post("/upload")
async def upload_contacts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large. Maximum size is 200 MB.")

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
    email = str(staff.email).strip().lower()
    existing = db.query(StaffMember).filter(
        StaffMember.broker_id == current_user.id,
        func.lower(StaffMember.email) == email,
        StaffMember.is_active.is_(True),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A staff member with this email already exists")

    new_staff = StaffMember(
        broker_id=current_user.id,
        name=staff.name.strip(),
        email=email,
        is_active=True,
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


@router.get("/staff", response_model=list[StaffMemberResponse])
def get_staff_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(StaffMember)
        .filter(
            StaffMember.broker_id == current_user.id,
            StaffMember.is_active.is_(True),
        )
        .order_by(StaffMember.id)
        .all()
    )


@router.put("/staff/{staff_id}", response_model=StaffMemberResponse)
def update_staff_member(
    staff_id: int,
    staff: StaffMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(StaffMember).filter(
        StaffMember.id == staff_id,
        StaffMember.broker_id == current_user.id,
        StaffMember.is_active.is_(True),
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Staff member not found")

    email = str(staff.email).strip().lower()
    duplicate = db.query(StaffMember).filter(
        StaffMember.broker_id == current_user.id,
        StaffMember.id != staff_id,
        StaffMember.is_active.is_(True),
        func.lower(StaffMember.email) == email,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Another staff member already uses this email")

    member.name = staff.name.strip()
    member.email = email
    db.commit()
    db.refresh(member)
    return member


@router.delete("/staff/{staff_id}")
def delete_staff_member(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(StaffMember).filter(
        StaffMember.id == staff_id,
        StaffMember.broker_id == current_user.id,
        StaffMember.is_active.is_(True),
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Staff member not found")

    # Keep assignment history intact. "Delete" means remove from the active team.
    member.is_active = False
    db.commit()
    return {"status": "success", "message": f"{member.name} removed from active staff"}


@router.post("/configure")
def configure_distribution(
    config: DistributionConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    if not 1 <= config.contacts_per_person <= 5000:
        raise HTTPException(status_code=400, detail="contacts_per_person must be between 1 and 5000")
    if not config.selected_days:
        raise HTTPException(status_code=400, detail="Select at least one day")
    if not re.fullmatch(r"\d{2}:\d{2}", config.send_time):
        raise HTTPException(status_code=400, detail="send_time must use HH:MM format")

    hour, minute = map(int, config.send_time.split(":"))
    if hour > 23 or minute > 59:
        raise HTTPException(status_code=400, detail="Invalid send_time")

    db_config = _get_config(db, current_user.id)
    if db_config is None:
        db_config = DistributionConfigModel(broker_id=current_user.id)
        db.add(db_config)

    db_config.contacts_per_person = config.contacts_per_person
    db_config.selected_days = ",".join(str(day).strip().lower() for day in config.selected_days if str(day).strip())
    db_config.send_time = config.send_time
    db_config.enabled = config.enabled
    db.commit()
    db.refresh(db_config)

    return {
        "status": "success",
        "message": "Configuration saved",
        "config": {
            "contacts_per_person": db_config.contacts_per_person,
            "selected_days": db_config.selected_days.split(","),
            "send_time": db_config.send_time,
            "enabled": db_config.enabled,
        },
    }


@router.post("/distribute-now")
def distribute_leads_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)

    config = _get_config(db, current_user.id)
    contacts_per_person = config.contacts_per_person if config else DEFAULT_CONTACTS_PER_PERSON

    try:
        result = distribute_for_broker(db, current_user.id, contacts_per_person)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lead distribution failed; no changes were saved")

    return {"status": "success", **result}


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
    staff_count = db.query(StaffMember).filter(
        StaffMember.broker_id == current_user.id,
        StaffMember.is_active.is_(True),
    ).count()
    total_contacts = db.query(DistributionContact).filter(
        DistributionContact.broker_id == current_user.id
    ).count()
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
        "daily_capacity": staff_count * (
            _get_config(db, current_user.id).contacts_per_person
            if _get_config(db, current_user.id)
            else DEFAULT_CONTACTS_PER_PERSON
        ),
    }


@router.post("/send-emails")
def send_emails_to_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(current_user)
    staff_list = db.query(StaffMember).filter(
        StaffMember.broker_id == current_user.id,
        StaffMember.is_active.is_(True),
    ).all()

    sent_count = 0
    failed_count = 0
    skipped_count = 0
    today = date.today()

    for staff in staff_list:
        history = db.query(DistributionHistory).filter(
            DistributionHistory.staff_id == staff.id,
            DistributionHistory.assigned_date == today,
        ).all()
        if not history:
            skipped_count += 1
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
        "staff_without_leads": skipped_count,
        "message": f"Sent {sent_count} email(s); {failed_count} failed; {skipped_count} staff had no leads today.",
    }
