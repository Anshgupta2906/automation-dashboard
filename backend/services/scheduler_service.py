from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models.distribution import DistributionContact, StaffMember, DistributionHistory
from backend.models.message import MessageContact, MessageLog
import random
from datetime import date

scheduler = BackgroundScheduler()

def distribute_leads_job():
    """Job that runs daily at 8 AM to distribute leads"""
    db = SessionLocal()
    try:
        print("🔔 Starting lead distribution job...")
        
        # Get all staff members
        staff_members = db.query(StaffMember).all()
        if not staff_members:
            print("❌ No staff members configured")
            return
        
        # Get contacts not distributed today
        today = date.today()
        distributed_today = db.query(DistributionHistory).filter(
            DistributionHistory.assigned_date == today
        ).all()
        
        distributed_contact_ids = {d.contact_id for d in distributed_today}
        
        # Get available contacts
        all_contacts = db.query(DistributionContact).all()
        available_contacts = [c for c in all_contacts if c.id not in distributed_contact_ids]
        
        if not available_contacts:
            print("⚠️ No new contacts available for distribution")
            return
        
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
        
        print(f"✅ Lead distribution complete: {total_distributed} contacts distributed to {len(staff_members)} staff")
    
    except Exception as e:
        print(f"❌ Error in lead distribution: {str(e)}")
    
    finally:
        db.close()

def send_messages_job():
    """Job that runs daily at 9 AM to send messages"""
    db = SessionLocal()
    try:
        print("🔔 Starting message sending job...")
        
        # Get all message contacts
        contacts = db.query(MessageContact).all()
        
        if not contacts:
            print("❌ No contacts to send messages to")
            return
        
        sent_count = 0
        failed_count = 0
        
        for contact in contacts:
            try:
                # TODO: Integrate with SMS/WhatsApp API here
                # For now, just log as sent
                log = MessageLog(
                    contact_id=contact.id,
                    status="sent",
                    channel="placeholder"
                )
                db.add(log)
                sent_count += 1
            except Exception as e:
                log = MessageLog(
                    contact_id=contact.id,
                    status="failed",
                    channel="placeholder"
                )
                db.add(log)
                failed_count += 1
        
        db.commit()
        
        print(f"✅ Message sending complete: {sent_count} sent, {failed_count} failed")
    
    except Exception as e:
        print(f"❌ Error in message sending: {str(e)}")
    
    finally:
        db.close()

def start_scheduler():
    """Start the background scheduler"""
    if not scheduler.running:
        # Schedule lead distribution at 8 AM daily
        scheduler.add_job(
            distribute_leads_job,
            trigger=CronTrigger(hour=8, minute=0),
            id="distribute_leads",
            name="Distribute leads at 8 AM",
            replace_existing=True
        )
        
        # Schedule message sending at 9 AM daily
        scheduler.add_job(
            send_messages_job,
            trigger=CronTrigger(hour=9, minute=0),
            id="send_messages",
            name="Send messages at 9 AM",
            replace_existing=True
        )
        
        scheduler.start()
        print("✅ Scheduler started!")

def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        print("✅ Scheduler stopped!")