"""Shared serialization helpers for API responses."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models import Classification, Document, ExtractedField, OcrResult, ValidationResult
from app.services.confidence import confidence_band

SEVERITY_ORDER = {"error": 0, "warning": 1}


def _iso(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def doc_summary(document: Document) -> dict:
    return {
        "id": document.id,
        "filename": document.filename,
        "document_type": document.document_type or "unclassified",
        "status": document.status,
        "file_type": document.file_type,
        "file_size": document.file_size or 0,
        "page_count": document.page_count or 0,
        "overall_confidence": round(float(document.overall_confidence or 0.0), 4),
        "processing_time_ms": int(document.processing_time_ms or 0),
        "is_demo": bool(document.is_demo),
        "created_at": _iso(document.created_at),
        "updated_at": _iso(document.updated_at),
        "error_message": document.error_message,
    }


def doc_detail(db: Session, document: Document) -> dict:
    data = doc_summary(document)

    classification = (
        db.query(Classification)
        .filter(Classification.document_id == document.id)
        .order_by(Classification.id.desc())
        .first()
    )
    data["classification"] = (
        {
            "document_type": classification.document_type,
            "confidence": round(float(classification.confidence), 4),
            "model": classification.model_name,
        }
        if classification
        else None
    )

    validations = []
    for row in db.query(ValidationResult).filter(ValidationResult.document_id == document.id):
        try:
            details = json.loads(row.details_json or "{}")
        except (TypeError, ValueError):
            details = {}
        validations.append(
            {
                "rule": row.rule,
                "passed": bool(row.passed),
                "message": row.message,
                "severity": details.get("severity", "error"),
                "fields": details.pop("fields", []),
                "details": details,
            }
        )
    validations.sort(key=lambda r: (r["passed"], SEVERITY_ORDER.get(r["severity"], 2)))
    data["validations"] = validations

    fields = []
    medium = 0.75
    for row in db.query(ExtractedField).filter(ExtractedField.document_id == document.id):
        fields.append(
            {
                "name": row.field_name,
                "value": row.value or "",
                "confidence": round(float(row.confidence or 0.0), 4),
                "source": row.source,
                "is_corrected": bool(row.is_corrected),
                "original_value": row.original_value,
                "band": confidence_band(float(row.confidence or 0.0), medium=medium),
            }
        )
    fields.sort(key=lambda f: f["name"])
    data["fields"] = fields

    from app.models import DocumentPage, LineItem, ReviewAction

    data["line_items"] = [
        {
            "position": row.position,
            "description": row.description,
            "quantity": row.quantity,
            "unit_price": row.unit_price,
            "tax": row.tax,
            "total": row.total,
        }
        for row in db.query(LineItem)
        .filter(LineItem.document_id == document.id)
        .order_by(LineItem.position)
    ]

    data["pages"] = [
        {"page_number": row.page_number, "width": row.width, "height": row.height}
        for row in db.query(DocumentPage)
        .filter(DocumentPage.document_id == document.id)
        .order_by(DocumentPage.page_number)
    ]

    ocr_rows = (
        db.query(OcrResult)
        .filter(OcrResult.document_id == document.id)
        .order_by(OcrResult.page_number)
        .all()
    )
    data["ocr_text"] = "\n".join(row.text or "" for row in ocr_rows)[:100_000]
    confs = [row.confidence for row in ocr_rows if row.confidence]
    data["ocr_confidence"] = round(sum(confs) / len(confs), 4) if confs else 0.0

    data["review_actions"] = [
        {
            "field_name": row.field_name,
            "original_value": row.original_value,
            "new_value": row.new_value,
            "created_at": _iso(row.created_at),
        }
        for row in db.query(ReviewAction)
        .filter(ReviewAction.document_id == document.id)
        .order_by(ReviewAction.id.desc())
        .limit(50)
    ]
    return data
