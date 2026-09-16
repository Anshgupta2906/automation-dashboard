import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.distribution import DistributionContact, StaffMember, DistributionHistory
from backend.schemas.distribution_schema import (
    StaffMemberCreate, StaffMemberResponse, DistributionConfig
)
import csv
import io
from datetime import date
import random

router = APIRouter(prefix="/api/lead-distributor", tags=["lead-distributor"])

@router.post("/upload")
async def upload_contacts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload Excel/CSV file with 5 lakh contacts"""
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        contacts_added = 0
        
        for row in csv_reader:
            phone = row.get('phone') or row.get('Phone')
            name = row.get('name') or row.get('Name')
            
            if not phone:
                continue
            
            # Check if contact already exists
            existing = db.query(DistributionContact).filter(
                DistributionContact.phone == phone
            ).first()
            
            if not existing:
                contact = DistributionContact(
                    broker_id=1,  # TODO: Get from JWT token
                    phone=phone,
                    name=name
                )
                db.add(contact)
                contacts_added += 1
        
        db.commit()
        
        return {
            "status": "success",
            "contacts_added": contacts_added,
            "message": f"Successfully uploaded {contacts_added} contacts"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing file: {str(e)}"
        )

@router.post("/staff", response_model=StaffMemberResponse)
async def add_staff_member(
    staff: StaffMemberCreate,
    db: Session = Depends(get_db)
):
    """Add a staff member for lead distribution"""
    new_staff = StaffMember(
        broker_id=1,  # TODO: Get from JWT token
        name=staff.name,
        email=staff.email
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@router.get("/staff")
async def get_staff_members(db: Session = Depends(get_db)):
    """Get all staff members"""
    staff_list = db.query(StaffMember).all()
    return staff_list

@router.post("/configure")
async def configure_distribution(
    config: DistributionConfig,
    db: Session = Depends(get_db)
):
    """Configure distribution settings"""
    # TODO: Save configuration to database/cache
    return {
        "status": "success",
        "message": "Distribution configured successfully",
        "config": config
    }

@router.post("/distribute-now")
async def distribute_leads_now(
    db: Session = Depends(get_db)
):
    """Manually trigger lead distribution"""
    try:
        # Get all staff members
        staff_members = db.query(StaffMember).all()
        if not staff_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No staff members configured"
            )
        
        # Get all contacts that haven't been distributed today
        today = date.today()
        distributed_today = db.query(DistributionHistory).filter(
            DistributionHistory.assigned_date == today
        ).all()
        
        distributed_contact_ids = {d.contact_id for d in distributed_today}
        
        # Get available contacts
        all_contacts = db.query(DistributionContact).all()
        available_contacts = [c for c in all_contacts if c.id not in distributed_contact_ids]
        
        if not available_contacts:
            return {
                "status": "warning",
                "message": "No new contacts available for distribution"
            }
        
        # Distribute 300 contacts per staff member
        contacts_per_person = 300
        total_distributed = 0
        
        for staff in staff_members:
            # Pick random contacts for this staff member
            if len(available_contacts) >= contacts_per_person:
                selected = random.sample(available_contacts, contacts_per_person)
                available_contacts = [c for c in available_contacts if c not in selected]
            else:
                selected = available_contacts
                available_contacts = []
            
            # Save to distribution history
            for contact in selected:
                history = DistributionHistory(
                    contact_id=contact.id,
                    staff_id=staff.id,
                    assigned_date=today
                )
                db.add(history)
                total_distributed += 1
        
        db.commit()
        
        return {
            "status": "success",
            "total_distributed": total_distributed,
            "staff_count": len(staff_members),
            "per_staff": total_distributed // len(staff_members) if staff_members else 0
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during distribution: {str(e)}"
        )

@router.get("/history")
async def get_distribution_history(db: Session = Depends(get_db)):
    """Get distribution history"""
    history = db.query(DistributionHistory).all()
    return history

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get distribution statistics"""
    total_contacts = db.query(DistributionContact).count()
    staff_count = db.query(StaffMember).count()
    today_distributed = db.query(DistributionHistory).filter(
        DistributionHistory.assigned_date == date.today()
    ).count()
    
    return {
        "total_contacts": total_contacts,
        "staff_count": staff_count,
        "distributed_today": today_distributed
    }