import time
from datetime import datetime, timezone


def send_notification(channel: str, message: str) -> dict:
    ts = str(time.time())
    return {
        "ok": True,
        "channel": channel,
        "ts": ts,
        "message_preview": message[:100],
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
