import os
from datetime import datetime, time
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import and_

from backend.database import SessionLocal
from backend.models.distribution import DistributionConfig, DistributionHistory, StaffMember
from backend.models.message import MessageCampaign, MessageContact, MessageLog
from backend.routes.lead_distributor import distribute_for_broker
from backend.services.email_service import send_leads_email

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Kolkata").strip() or "Asia/Kolkata"
APP_TZ = ZoneInfo(APP_TIMEZONE)
scheduler = BackgroundScheduler(timezone=APP_TZ)


def _send_daily_lead_emails(db, broker_id: int, today) -> tuple[int, int, int]:
    staff_members = db.query(StaffMember).filter(
        StaffMember.broker_id == broker_id,
        StaffMember.is_active.is_(True),
    ).all()

    sent = failed = skipped = 0

    for staff in staff_members:
        history = db.query(DistributionHistory).filter(
            DistributionHistory.staff_id == staff.id,
            DistributionHistory.assigned_date == today,
        ).all()

        if not history:
            skipped += 1
            continue

        contact_ids = [item.contact_id for item in history]
        from backend.models.distribution import DistributionContact

        contacts = db.query(DistributionContact).filter(
            DistributionContact.broker_id == broker_id,
            DistributionContact.id.in_(contact_ids),
        ).all()

        payload = [{"phone": c.phone, "name": c.name or "N/A"} for c in contacts]

        if send_leads_email(staff.email, staff.name, payload, email_date=today):
            sent += 1
        else:
            failed += 1

    return sent, failed, skipped


def distribute_leads_job():
    db = SessionLocal()
    try:
        now = datetime.now(scheduler.timezone)
        today = now.date()
        current_day = now.strftime("%A").lower()
        current_time = now.strftime("%H:%M")

        configs = db.query(DistributionConfig).filter(
            DistributionConfig.enabled.is_(True),
            DistributionConfig.send_time == current_time,
        ).all()

        for config in configs:
            selected_days = {
                day.strip().lower()
                for day in config.selected_days.split(",")
                if day.strip()
            }
            if current_day not in selected_days:
                continue

            result = distribute_for_broker(
                db,
                config.broker_id,
                config.contacts_per_person,
            )
            db.commit()

            _send_daily_lead_emails(db, config.broker_id, today)

        # Keep scheduler failures isolated; one broker must not stop others.
    except Exception:
        db.rollback()
    finally:
        db.close()


def queue_due_message_campaigns():
    db = SessionLocal()
    try:
        now = datetime.now(scheduler.timezone)
        today = now.date()
        current_day = now.strftime("%A").lower()
        current_time = now.strftime("%H:%M")
        day_start = datetime.combine(today, time.min)

        campaigns = db.query(MessageCampaign).filter(
            MessageCampaign.enabled.is_(True),
            MessageCampaign.send_time == current_time,
        ).all()

        for campaign in campaigns:
            if current_day not in {day.strip().lower() for day in campaign.selected_days.split(",") if day.strip()}:
                continue

            existing_contact_ids = {
                contact_id
                for (contact_id,) in db.query(MessageLog.contact_id).filter(
                    MessageLog.campaign_id == campaign.id,
                    MessageLog.created_at >= day_start,
                ).all()
            }

            contacts_query = db.query(MessageContact).filter(
                MessageContact.broker_id == campaign.broker_id
            )
            if existing_contact_ids:
                contacts_query = contacts_query.filter(~MessageContact.id.in_(existing_contact_ids))

            contacts = contacts_query.order_by(MessageContact.id).all()
            for contact in contacts:
                db.add(MessageLog(
                    contact_id=contact.id,
                    campaign_id=campaign.id,
                    status="queued",
                    channel=campaign.channel,
                ))

        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return

    scheduler.add_job(
        distribute_leads_job,
        "interval",
        minutes=1,
        id="distribute_leads",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        queue_due_message_campaigns,
        "interval",
        minutes=1,
        id="queue_message_campaigns",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
