"""Export endpoints: JSON, CSV, XLSX, PDF — generated locally."""

from __future__ import annotations

from fastapi import APIRouter, Response
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models import Document
from app.security.files import sanitized_export_name
from app.services.audit import log_action
from app.services.export.exporters import (
    build_payload,
    payload_to_csv,
    payload_to_json,
    payload_to_pdf,
    payload_to_xlsx,
)
from app.services.settings_service import get_settings
from app.utils.errors import AppError, NotFoundError

router = APIRouter(prefix="/api/export", tags=["export"])

_MEDIA = {
    "json": "application/json",
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


@router.get("/{document_id}/{fmt}")
def export_document(document_id: str, fmt: str):
    fmt = fmt.lower()
    if fmt not in _MEDIA:
        raise AppError(
            "Unsupported export format.",
            code="invalid_format",
            status=400,
            hint="Use json, csv, xlsx or pdf.",
        )

    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            raise NotFoundError("Document")

        settings = get_settings(db)
        payload = build_payload(db, document)
        include_conf = bool(settings.get("export_include_confidence", True))

        try:
            if fmt == "json":
                body = payload_to_json(payload)
            elif fmt == "csv":
                body = payload_to_csv(payload, include_confidence=include_conf)
            elif fmt == "xlsx":
                body = payload_to_xlsx(payload, include_confidence=include_conf)
            else:
                body = payload_to_pdf(payload)
        except Exception:
            raise AppError(
                f"We couldn't generate the {fmt.upper()} export.",
                code="export_failed",
                status=500,
                hint="Try again or choose another format.",
            )

        filename = sanitized_export_name(document.id, document.document_type or "document", fmt)
        log_action(
            db, "document_exported", entity_type="document", entity_id=document.id,
            detail=f"format={fmt}",
        )
        return Response(
            content=body,
            media_type=_MEDIA[fmt],
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        db.close()
