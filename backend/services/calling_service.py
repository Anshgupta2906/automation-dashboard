import random
from datetime import date
from sqlalchemy.orm import Session
from backend.models.distribution import DistributionContact, StaffMember, DistributionHistory
from backend.models.call import CallLog
import asyncio

# Placeholder for Exotel API (will replace with real API later)
class ExotelPlaceholder:
    def __init__(self, sid, api_key, company_number):
        self.sid = sid
        self.api_key = api_key
        self.company_number = company_number
    
    async def make_call(self, from_number, to_number):
        """Placeholder - replace with real Exotel API call"""
        print(f"[PLACEHOLDER] Calling {to_number} from {from_number}")
        # TODO: Replace with actual Exotel API call
        # return {"success": True, "call_id": "xxx"}
        return {"success": True, "call_id": "placeholder_123"}

# Initialize placeholder (will be replaced with real credentials)
exotel_client = ExotelPlaceholder(
    sid="placeholder_sid",
    api_key="placeholder_api_key",
    company_number="18002222222"
)

class CallingSystem:
    def __init__(self, db: Session, staff_id: int, buffer_seconds: int = 10):
        self.db = db
        self.staff_id = staff_id
        self.buffer_seconds = buffer_seconds
        self.is_running = False
    
    async def get_today_contacts(self):
        """Get contacts distributed to this staff today"""
        today = date.today()
        history = self.db.query(DistributionHistory).filter(
            DistributionHistory.staff_id == self.staff_id,
            DistributionHistory.assigned_date == today
        ).all()
        
        contact_ids = [h.contact_id for h in history]
        contacts = self.db.query(DistributionContact).filter(
            DistributionContact.id.in_(contact_ids)
        ).all()
        
        return contacts
    
    async def get_uncalled_contacts(self):
        """Get contacts that haven't been called today"""
        today = date.today()
        
        # Get all contacts called today
        called_today = self.db.query(CallLog).filter(
            CallLog.staff_id == self.staff_id,
            CallLog.called_at >= today
        ).all()
        
        called_ids = {c.contact_id for c in called_today}
        
        # Get today's distributed contacts
        all_today = await self.get_today_contacts()
        
        # Return uncalled contacts
        uncalled = [c for c in all_today if c.id not in called_ids]
        return uncalled
    
    async def make_call_to_contact(self, contact):
        """Make a call to a contact"""
        try:
            staff = self.db.query(StaffMember).filter(
                StaffMember.id == self.staff_id
            ).first()
            
            # Create call log
            call_log = CallLog(
                contact_id=contact.id,
                staff_id=self.staff_id,
                call_status="pending"
            )
            self.db.add(call_log)
            self.db.commit()
            
            # Make the call (placeholder)
            result = await exotel_client.make_call(
                from_number=exotel_client.company_number,
                to_number=contact.phone
            )
            
            if result["success"]:
                call_log.call_status = "answered"
                print(f"✅ Call to {contact.phone} initiated")
            else:
                call_log.call_status = "failed"
                print(f"❌ Call to {contact.phone} failed")
            
            self.db.commit()
            return call_log
        
        except Exception as e:
            print(f"❌ Error making call: {str(e)}")
            return None
    
    async def start_calling(self):
        """Start auto-dialing loop"""
        self.is_running = True
        print(f"🚀 Starting call system for staff {self.staff_id}")
        
        while self.is_running:
            try:
                # Get uncalled contacts
                contacts = await self.get_uncalled_contacts()
                
                if not contacts:
                    print(f"✅ All contacts called for today")
                    break
                
                # Pick random contact
                contact = random.choice(contacts)
                
                # Make call
                await self.make_call_to_contact(contact)
                
                # Wait buffer time before next call
                print(f"⏳ Waiting {self.buffer_seconds} seconds before next call...")
                await asyncio.sleep(self.buffer_seconds)
            
            except Exception as e:
                print(f"❌ Error in calling loop: {str(e)}")
                await asyncio.sleep(5)
    
    def stop_calling(self):
        """Stop auto-dialing"""
        self.is_running = False
        print(f"🛑 Stopping call system for staff {self.staff_id}")

# Global calling systems (one per staff)
active_calls = {}

async def start_calling_for_staff(db: Session, staff_id: int, buffer_seconds: int):
    """Start calling system for a staff member"""
    system = CallingSystem(db, staff_id, buffer_seconds)
    active_calls[staff_id] = system
    await system.start_calling()

def stop_calling_for_staff(staff_id: int):
    """Stop calling system for a staff member"""
    if staff_id in active_calls:
        active_calls[staff_id].stop_calling()
        del active_calls[staff_id]

def is_calling(staff_id: int):
    """Check if calling is active for staff"""
    return staff_id in active_calls and active_calls[staff_id].is_running