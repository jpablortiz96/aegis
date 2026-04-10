"""
Incident deduplication using Jaccard similarity on word tokens.
Not a blocker — runs as an informational pipeline step.
"""
import re
import logging
import aiosqlite
from typing import List, Dict

logger = logging.getLogger(__name__)

_STOP_WORDS = {
    "the", "and", "for", "are", "was", "with", "that", "this",
    "have", "from", "not", "but", "has", "had", "its", "our",
    "all", "been", "when", "after", "than", "into", "they",
}


def _tokenize(text: str) -> set:
    """Extract lowercase alpha tokens (≥3 chars), removing stop words."""
    tokens = set(re.findall(r"\b[a-z]{3,}\b", text.lower()))
    return tokens - _STOP_WORDS


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


async def check_similar_incidents(
    title: str,
    description: str,
    exclude_id: str = None,
    threshold: float = 0.25,
) -> List[Dict]:
    """
    Query the last 50 incidents and return those with Jaccard similarity
    above `threshold` against (title + description).

    Returns a list sorted by similarity desc (max 5).
    """
    from app.models import DB_PATH

    query_tokens = _tokenize(f"{title} {description}")
    if not query_tokens:
        return []

    similar: List[Dict] = []
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """SELECT id, title, description, severity, category, status
                   FROM incidents
                   ORDER BY created_at DESC
                   LIMIT 50"""
            ) as cursor:
                rows = await cursor.fetchall()

        for row in rows:
            if exclude_id and row["id"] == exclude_id:
                continue
            candidate = _tokenize(f"{row['title']} {row['description']}")
            score = _jaccard(query_tokens, candidate)
            if score >= threshold:
                similar.append(
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "severity": row["severity"],
                        "category": row["category"],
                        "status": row["status"],
                        "similarity_score": round(score, 3),
                    }
                )
    except Exception as exc:
        logger.warning("Deduplication check failed: %s", exc)
        return []

    similar.sort(key=lambda x: x["similarity_score"], reverse=True)
    return similar[:5]
