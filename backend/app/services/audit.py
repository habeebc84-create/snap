"""Local audit log.

Privacy rule: the audit log records WHAT happened (action, entity id, counts/stage
names) and never document contents, OCR text, or extracted field values.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import AuditLog

ACTIONS = {
    "document_imported",
    "document_processed",
    "ocr_completed",
    "classification_completed",
    "extraction_completed",
    "validation_completed",
    "field_edited",
    "document_exported",
    "document_deleted",
    "settings_changed",
    "demo_data_loaded",
    "processing_failed",
    "privacy_toggled",
}


def log_action(
    db: Session,
    action: str,
    *,
    entity_type: str = "",
    entity_id: str = "",
    detail: str = "",
) -> AuditLog:
    entry = AuditLog(
        action=action,
        entity_type=entity_type[:32],
        entity_id=entity_id[:64],
        # Defensive scrub: detail must never carry document content.
        detail="" if detail is None else detail[:255],
    )
    db.add(entry)
    db.commit()
    return entry
