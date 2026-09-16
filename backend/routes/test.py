import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter
from backend.services.email_service import send_test_email

router = APIRouter(prefix="/api/test", tags=["test"])

@router.post("/send-email")
async def test_send_email(recipient_email: str):
    """Send a test email"""
    success = send_test_email(recipient_email)
    return {
        "status": "success" if success else "failed",
        "message": f"Test email sent to {recipient_email}"
    }