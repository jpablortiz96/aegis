import uuid
from datetime import datetime, timezone


def send_email(to: str, subject: str, body: str) -> dict:
    return {
        "message_id": str(uuid.uuid4()),
        "to": to,
        "subject": subject,
        "status": "sent",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
