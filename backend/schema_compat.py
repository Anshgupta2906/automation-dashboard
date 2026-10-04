from sqlalchemy import text

from backend.database import engine


def ensure_schema_compatibility() -> None:
    """Apply small idempotent PostgreSQL changes for existing installations."""
    statements = [
        """
        ALTER TABLE message_logs
        ADD COLUMN IF NOT EXISTS campaign_id INTEGER
        """,
        """
        ALTER TABLE message_logs
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        """,
        """
        ALTER TABLE message_logs
        ALTER COLUMN sent_at DROP DEFAULT
        """,
        """
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
        """,
        """
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
        """,
        """
        ALTER TABLE staff_members
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
        """,
        """
        ALTER TABLE staff_members
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR
        """,
        """
        ALTER TABLE staff_members
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE
        """,
        """
        ALTER TABLE call_logs
        ADD COLUMN IF NOT EXISTS provider_call_id VARCHAR
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_call_logs_provider_call_id
        ON call_logs (provider_call_id)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_distribution_history_staff_contact
        ON distribution_history (staff_id, contact_id)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_distribution_history_staff_date
        ON distribution_history (staff_id, assigned_date)
        """,
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
