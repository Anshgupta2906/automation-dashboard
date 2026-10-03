import os
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import and_

from backend.database import SessionLocal
from backend.models.distribution import DistributionContact, DistributionHistory, StaffMember
from backend.models.message import MessageCampaign, MessageContact, MessageLog

scheduler = BackgroundScheduler(timezone=ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata")))


def distribute_leads_job():
    db = SessionLocal()
    try:
        today = date.today()
        staff_members = db.query(StaffMember).all()

        for staff in staff_members:
            assigned_today = db.query(DistributionHistory).filter(
                DistributionHistory.staff_id == staff.id,
                DistributionHistory.assigned_date == today,
            ).count()
            capacity = max(0, 300 - assigned_today)
            if not capacity:
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
                    DistributionContact.broker_id == staff.broker_id,
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
            db.flush()

        db.commit()
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
        "cron",
        hour=8,
        minute=0,
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
