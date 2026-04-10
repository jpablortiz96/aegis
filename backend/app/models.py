import json
import aiosqlite
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr

from app.config import get_settings

settings = get_settings()

DB_PATH = settings.db_path

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_path TEXT,
    status TEXT DEFAULT 'submitted',
    severity TEXT,
    category TEXT,
    summary TEXT,
    ticket_id TEXT,
    reporter_email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pipeline_log TEXT DEFAULT '[]'
)
"""


async def init_db():
    import os
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_TABLE_SQL)
        await db.commit()


async def get_db():
    return aiosqlite.connect(DB_PATH)


# ---------- Pydantic models ----------

class PipelineStep(BaseModel):
    step: str
    status: str  # running | success | error | skipped
    result: Optional[Any] = None
    timestamp: str
    duration_ms: Optional[int] = None


class IncidentCreate(BaseModel):
    title: str
    description: str
    reporter_email: str


class IncidentOut(BaseModel):
    id: str
    title: str
    description: str
    image_path: Optional[str] = None
    status: str
    severity: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    ticket_id: Optional[str] = None
    reporter_email: Optional[str] = None
    created_at: str
    updated_at: str
    pipeline_log: List[PipelineStep] = []


# ---------- DB helpers ----------

def _row_to_incident(row, columns) -> dict:
    d = dict(zip(columns, row))
    if d.get("pipeline_log"):
        try:
            d["pipeline_log"] = json.loads(d["pipeline_log"])
        except Exception:
            d["pipeline_log"] = []
    else:
        d["pipeline_log"] = []
    if d.get("created_at") and isinstance(d["created_at"], datetime):
        d["created_at"] = d["created_at"].isoformat()
    if d.get("updated_at") and isinstance(d["updated_at"], datetime):
        d["updated_at"] = d["updated_at"].isoformat()
    return d


async def create_incident(data: dict) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO incidents
               (id, title, description, image_path, reporter_email, created_at, updated_at, pipeline_log)
               VALUES (:id, :title, :description, :image_path, :reporter_email,
                       :created_at, :updated_at, :pipeline_log)""",
            data,
        )
        await db.commit()
    return await get_incident(data["id"])


async def get_incident(incident_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM incidents WHERE id = ?", (incident_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return _row_to_incident(tuple(row), row.keys())


async def list_incidents() -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM incidents ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [_row_to_incident(tuple(r), r.keys()) for r in rows]


async def update_incident(incident_id: str, fields: dict):
    fields["updated_at"] = datetime.utcnow().isoformat()
    if "pipeline_log" in fields and not isinstance(fields["pipeline_log"], str):
        fields["pipeline_log"] = json.dumps(fields["pipeline_log"])
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = incident_id
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE incidents SET {set_clause} WHERE id = :id", fields
        )
        await db.commit()
