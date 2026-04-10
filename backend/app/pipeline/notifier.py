from app.mocks.slack_mock import send_notification as slack_notify
from app.mocks.email_mock import send_email


SEVERITY_EMOJI = {
    "critical": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "🟢",
}


def notify_team(
    incident_id: str,
    title: str,
    severity: str,
    summary: str,
    ticket_id: str,
    reporter_email: str,
) -> dict:
    emoji = SEVERITY_EMOJI.get(severity.lower(), "⚪")

    slack_message = (
        f"{emoji} *[{severity.upper()}] New Incident: {title}*\n"
        f"ID: `{incident_id[:8]}`  |  Ticket: `{ticket_id}`\n"
        f"_{summary[:200]}_\n"
        f"<https://jira.example.com/browse/{ticket_id}|View Ticket>"
    )

    slack_result = slack_notify(channel="#sre-incidents", message=slack_message)

    email_result = send_email(
        to=reporter_email,
        subject=f"[AEGIS] Incident received: {title} [{severity.upper()}]",
        body=(
            f"Hello,\n\nYour incident report has been received and processed.\n\n"
            f"Title: {title}\n"
            f"Severity: {severity.upper()}\n"
            f"Ticket ID: {ticket_id}\n"
            f"Summary: {summary}\n\n"
            f"The SRE team has been notified and will investigate shortly.\n\n"
            f"— AEGIS Incident Management"
        ),
    )

    return {
        "slack": slack_result,
        "email": email_result,
    }


def notify_reporter(
    incident_id: str,
    title: str,
    ticket_id: str,
    reporter_email: str,
    summary: str = "",
) -> dict:
    """Send resolution notification to the incident reporter."""
    email_result = send_email(
        to=reporter_email,
        subject=f"[AEGIS] Incident resolved: {title}",
        body=(
            f"Hello,\n\nGood news — your incident has been resolved.\n\n"
            f"Title: {title}\n"
            f"Ticket: {ticket_id}\n"
            f"Summary: {summary or 'N/A'}\n\n"
            f"If you experience further issues, please report a new incident.\n\n"
            f"— AEGIS Incident Management"
        ),
    )

    slack_result = slack_notify(
        channel="#sre-incidents",
        message=f"✅ Incident *{title}* (`{incident_id[:8]}`) marked as *RESOLVED* — reporter notified.",
    )

    return {
        "notified_email": reporter_email,
        "email": email_result,
        "slack": slack_result,
    }
