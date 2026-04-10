from app.mocks.jira_mock import create_ticket as jira_create_ticket


def create_ticket(title: str, description: str, severity: str, category: str) -> dict:
    return jira_create_ticket(
        title=title,
        description=description,
        severity=severity,
        category=category,
    )
