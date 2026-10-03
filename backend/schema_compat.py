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
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
