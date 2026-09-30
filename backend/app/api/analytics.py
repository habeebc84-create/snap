"""Analytics derived from the local SQLite database — no external service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import func

from app.database.session import SessionLocal
from app.models import AuditLog, Classification, Document, ExtractedField, ValidationResult
from app.schemas import AnalyticsOut

router = APIRouter(prefix="/api", tags=["analytics"])


def _float(value) -> float:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


@router.get("/analytics", response_model=AnalyticsOut)
def analytics() -> dict:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=None)

        total = db.query(func.count(Document.id)).scalar() or 0
        processed_today = (
            db.query(func.count(Document.id)).filter(Document.created_at >= today_start).scalar() or 0
        )
        needs_review = (
            db.query(func.count(Document.id)).filter(Document.status == "needs_review").scalar() or 0
        )
        failed = db.query(func.count(Document.id)).filter(Document.status == "failed").scalar() or 0

        storage_documents = db.query(func.coalesce(func.sum(Document.file_size), 0)).scalar() or 0
        storage_database = _db_size()
        storage_processed = _dir_size(_processed_root())

        by_type_rows = (
            db.query(Document.document_type, func.count(Document.id))
            .group_by(Document.document_type)
            .all()
        )
        known = ["invoice", "receipt", "purchase_order", "contract", "form", "other"]
        counts = {name: 0 for name in known}
        for name, count in by_type_rows:
            counts[name or "other"] = count

        window_start = (now - timedelta(days=29)).replace(tzinfo=None)
        per_day: dict[str, int] = {
            (window_start + timedelta(days=i)).strftime("%Y-%m-%d"): 0 for i in range(30)
        }
        for row in db.query(Document.created_at).filter(Document.created_at >= window_start):
            key = row[0].strftime("%Y-%m-%d")
            if key in per_day:
                per_day[key] += 1

        invoice_ids = [
            row.id for row in db.query(Document).filter(Document.document_type == "invoice")
        ]
        invoice_value = 0.0
        invoice_tax = 0.0
        if invoice_ids:
            for field_row in (
                db.query(ExtractedField)
                .filter(ExtractedField.document_id.in_(invoice_ids),
                        ExtractedField.field_name.in_(["total", "tax"]))
                .all()
            ):
                if field_row.field_name == "total":
                    invoice_value += _float(field_row.value)
                else:
                    invoice_tax += _float(field_row.value)

        conf_avg = db.query(func.avg(Document.overall_confidence)).filter(
            Document.status.in_(["completed", "needs_review"])
        ).scalar() or 0.0

        high = db.query(func.count(Document.id)).filter(
            Document.overall_confidence >= 0.90, Document.status.in_(["completed", "needs_review"])
        ).scalar() or 0
        medium = db.query(func.count(Document.id)).filter(
            Document.overall_confidence >= 0.75, Document.overall_confidence < 0.90,
            Document.status.in_(["completed", "needs_review"]),
        ).scalar() or 0
        review = db.query(func.count(Document.id)).filter(
            Document.overall_confidence < 0.75, Document.status.in_(["completed", "needs_review"])
        ).scalar() or 0

        validations_passed = db.query(func.count(ValidationResult.id)).filter(
            ValidationResult.passed.is_(True)
        ).scalar() or 0
        validations_failed = db.query(func.count(ValidationResult.id)).filter(
            ValidationResult.passed.is_(False)
        ).scalar() or 0

        avg_ms = db.query(func.avg(Document.processing_time_ms)).filter(
            Document.status.in_(["completed", "needs_review"])
        ).scalar() or 0

        audit_count = db.query(func.count(AuditLog.id)).scalar() or 0

        processed_docs = total  # every imported doc entered the pipeline or awaits it
        review_rate = (needs_review / processed_docs) if processed_docs else 0.0

        return {
            "kpis": {
                "total_documents": total,
                "processed_today": processed_today,
                "needs_review": needs_review,
                "failed": failed,
                "storage_used_bytes": int(storage_documents + storage_database + storage_processed),
                "audit_entries": audit_count,
            },
            "by_type": [{"type": name, "count": counts[name]} for name in known],
            "over_time": [{"date": day, "count": count} for day, count in per_day.items()],
            "totals": {
                "invoice_value": round(invoice_value, 2),
                "invoice_tax": round(invoice_tax, 2),
                "invoices": counts.get("invoice", 0),
                "receipts": counts.get("receipt", 0),
            },
            "confidence": {
                "average": round(float(conf_avg), 4),
                "high": high,
                "medium": medium,
                "review": review,
            },
            "review": {"needs_review": needs_review, "rate": round(review_rate, 4)},
            "validation": {"passed": validations_passed, "failed": validations_failed},
            "performance": {
                "avg_processing_ms": int(avg_ms),
                "storage": {
                    "documents_bytes": int(storage_documents),
                    "database_bytes": int(storage_database),
                    "processed_bytes": int(storage_processed),
                },
            },
        }
    finally:
        db.close()


def _db_size() -> int:
    from app.config import settings

    try:
        if settings.database_url.startswith("sqlite:///"):
            path = settings.database_url[len("sqlite:///"):]
            import os

            return os.path.getsize(path)
    except OSError:
        pass
    return 0


def _processed_root():
    from app.config import settings

    return settings.processed_path


def _dir_size(path) -> int:
    import os

    total = 0
    try:
        for root, _dirs, files in os.walk(path):
            for name in files:
                try:
                    total += os.path.getsize(os.path.join(root, name))
                except OSError:
                    continue
    except OSError:
        return 0
    return total
