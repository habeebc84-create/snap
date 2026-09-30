"""Security center endpoints: privacy status + local audit log."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func

from app.database.session import SessionLocal
from app.models import AuditLog, Document
from app.schemas import AuditLogOut
from app.services.settings_service import get_settings

router = APIRouter(prefix="/api", tags=["security"])


@router.get("/security/status")
def security_status() -> dict:
    db = SessionLocal()
    try:
        settings = get_settings(db)
        documents_bytes = db.query(func.coalesce(func.sum(Document.file_size), 0)).scalar() or 0

        from app.api.analytics import _db_size, _dir_size, _processed_root
        from app.config import settings as app_settings

        database_bytes = _db_size()
        processed_bytes = _dir_size(_processed_root())

        return {
            "local_processing": True,
            "no_cloud_upload": not settings["cloud_processing"],
            "local_database": True,
            "audit_logging": True,
            "document_deletion": True,
            "offline_mode": True,
            "privacy": {
                "cloud_processing": settings["cloud_processing"],
                "telemetry": settings["telemetry"],
                "anonymous_analytics": settings["anonymous_analytics"],
            },
            "storage": {
                "documents_bytes": int(documents_bytes),
                "database_bytes": int(database_bytes),
                "processed_bytes": int(processed_bytes),
                "total_bytes": int(documents_bytes + database_bytes + processed_bytes),
            },
            "database_path": app_settings.database_url.replace("sqlite:///", ""),
            "document_storage_path": str(app_settings.document_storage_path),
        }
    finally:
        db.close()


@router.get("/audit-logs", response_model=list[AuditLogOut])
def audit_logs(
    action: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    """Action-level audit trail. Never contains document contents or field values."""
    db = SessionLocal()
    try:
        query = db.query(AuditLog)
        if action:
            query = query.filter(AuditLog.action == action)
        rows = (
            query.order_by(AuditLog.id.desc()).limit(limit).offset(offset).all()
        )
        return [
            {
                "id": row.id,
                "action": row.action,
                "entity_type": row.entity_type or "",
                "entity_id": row.entity_id or "",
                "detail": row.detail or "",
                "created_at": row.created_at.isoformat() if row.created_at else "",
            }
            for row in rows
        ]
    finally:
        db.close()
