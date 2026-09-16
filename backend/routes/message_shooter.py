import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import openpyxl
from backend.models.distribution import DistributionContact, StaffMember, DistributionHistory
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.message import MessageContact
from backend.schemas.message_schema import MessageContactResponse, MessageSchedule
import csv
import io

router = APIRouter(prefix="/api/message-shooter", tags=["message-shooter"])

@router.post("/upload")
async def upload_contacts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload CSV or Excel file with contacts"""
    try:
        contents = await file.read()
        
        # Check file type
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            # Excel file
            import openpyxl
            from io import BytesIO
            
            excel_file = openpyxl.load_workbook(BytesIO(contents))
            sheet = excel_file.active
            
            contacts_added = 0
            
            for row in sheet.iter_rows(min_row=2, values_only=True):  # Skip header
                phone = row[0]  # First column is phone
                name = row[1] if len(row) > 1 else None  # Second column is name (optional)
                
                if not phone:
                    continue
                
                existing = db.query(DistributionContact).filter(
                    DistributionContact.phone == str(phone)
                ).first()
                
                if not existing:
                    contact = DistributionContact(
                        broker_id=1,
                        phone=str(phone),
                        name=str(name) if name else None
                    )
                    db.add(contact)
                    contacts_added += 1
            
            db.commit()
            
            return {
                "status": "success",
                "contacts_added": contacts_added,
                "file_type": "Excel",
                "message": f"Successfully uploaded {contacts_added} contacts from Excel"
            }
        
        else:
            # CSV file
            decoded = contents.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(decoded))
            
            contacts_added = 0
            
            for row in csv_reader:
                phone = row.get('phone') or row.get('Phone')
                name = row.get('name') or row.get('Name')
                
                if not phone:
                    continue
                
                existing = db.query(DistributionContact).filter(
                    DistributionContact.phone == phone
                ).first()
                
                if not existing:
                    contact = DistributionContact(
                        broker_id=1,
                        phone=phone,
                        name=name
                    )
                    db.add(contact)
                    contacts_added += 1
            
            db.commit()
            
            return {
                "status": "success",
                "contacts_added": contacts_added,
                "file_type": "CSV",
                "message": f"Successfully uploaded {contacts_added} contacts from CSV"
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing file: {str(e)}"
        )