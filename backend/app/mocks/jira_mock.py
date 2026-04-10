import random
from datetime import datetime, timezone


PRIORITY_MAP = {
    "critical": "P1",
    "high": "P2",
    "medium": "P3",
    "low": "P4",
}


def create_ticket(title: str, description: str, severity: str, category: str) -> dict:
    ticket_number = random.randint(1000, 9999)
    ticket_id = f"AEGIS-{ticket_number}"
    priority = PRIORITY_MAP.get(severity.lower(), "P3")

    return {
        "ticket_id": ticket_id,
        "url": f"https://jira.example.com/browse/{ticket_id}",
        "status": "open",
        "priority": priority,
        "title": title,
        "category": category,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
