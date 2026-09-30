"""Local full-text search + filters (parameterized ORM queries only)."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import doc_summary
from app.database.session import SessionLocal
from app.models import Document, ExtractedField, ValidationResult
from app.schemas import SearchResult

router = APIRouter(prefix="/api", tags=["search"])


def build_document_query(
    db: Session,
    *,
    q: str | None = None,
    document_type: str | None = None,
    status: str | None = None,
    needs_review: bool | None = None,
    vendor: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    min_confidence: float | None = None,
    max_confidence: float | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    review_filter: str | None = None,
):
    query = db.query(Document)

    if document_type:
        query = query.filter(Document.document_type == document_type)
    if status:
        query = query.filter(Document.status == status)
    if needs_review is True:
        query = query.filter(Document.status == "needs_review")
    elif needs_review is False:
        query = query.filter(Document.status.in_(["completed"]))
    if date_from:
        query = query.filter(Document.created_at >= date_from)
    if date_to:
        query = query.filter(Document.created_at <= date_to + "T23:59:59")
    if min_confidence is not None:
        query = query.filter(Document.overall_confidence >= min_confidence)
    if max_confidence is not None:
        query = query.filter(Document.overall_confidence <= max_confidence)

    if q and q.strip():
        pattern = f"%{q.strip()}%"
        field_ids = select(
            db.query(ExtractedField.document_id)
            .filter(or_(ExtractedField.value.like(pattern), ExtractedField.field_name.like(pattern)))
            .subquery().c.document_id
        )
        query = query.filter(
            or_(
                Document.filename.like(pattern),
                Document.document_type.like(pattern),
                Document.id.in_(field_ids),
            )
        )

    if vendor and vendor.strip():
        pattern = f"%{vendor.strip()}%"
        vendor_ids = select(
            db.query(ExtractedField.document_id)
            .filter(
                ExtractedField.field_name.in_(["vendor_name", "merchant", "customer_name"]),
                ExtractedField.value.like(pattern),
            )
            .subquery().c.document_id
        )
        query = query.filter(Document.id.in_(vendor_ids))

    if min_amount is not None or max_amount is not None:
        matching_ids = [
            row.document_id
            for row in db.query(ExtractedField).filter(ExtractedField.field_name == "total")
            if _in_range(row.value, min_amount, max_amount)
        ]
        # No matching totals ⇒ genuinely zero results (not "unfiltered").
        query = query.filter(Document.id.in_(matching_ids)) if matching_ids else query.filter(
            Document.id.is_(None)
        )

    if review_filter:
        query = _apply_review_filter(db, query, review_filter)

    return query


def _in_range(value, min_amount, max_amount) -> bool:
    try:
        amount = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return False
    if min_amount is not None and amount < min_amount:
        return False
    if max_amount is not None and amount > max_amount:
        return False
    return True


def _apply_review_filter(db: Session, query, review_filter: str):
    if review_filter == "low_confidence":
        return query.filter(Document.overall_confidence < 0.75)
    if review_filter == "missing_fields":
        failed = (
            db.query(ValidationResult.document_id)
            .filter(ValidationResult.rule == "required_fields", ValidationResult.passed.is_(False))
            .subquery()
        )
        return query.filter(Document.id.in_(select(failed.c.document_id)))
    if review_filter == "validation_errors":
        failed = (
            db.query(ValidationResult.document_id)
            .filter(ValidationResult.passed.is_(False), ValidationResult.severity == "error")
            .subquery()
        )
        return query.filter(Document.id.in_(select(failed.c.document_id)))
    if review_filter == "unclassified":
        return query.filter(
            or_(
                Document.document_type.in_(["other", "unclassified"]),
                Document.overall_confidence < 0.5,
            )
        )
    return query


@router.get("/search", response_model=SearchResult)
def search(
    q: str | None = Query(default=None, max_length=200),
    document_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    needs_review: bool | None = Query(default=None),
    vendor: str | None = Query(default=None, max_length=200),
    date_from: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    min_confidence: float | None = Query(default=None, ge=0, le=1),
    max_confidence: float | None = Query(default=None, ge=0, le=1),
    min_amount: float | None = Query(default=None, ge=0),
    max_amount: float | None = Query(default=None, ge=0),
    review_filter: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Search by filename, type, vendor/customer, invoice number, GSTIN, amount, date."""
    db = SessionLocal()
    try:
        query = build_document_query(
            db, q=q, document_type=document_type, status=status, needs_review=needs_review,
            vendor=vendor, date_from=date_from, date_to=date_to,
            min_confidence=min_confidence, max_confidence=max_confidence,
            min_amount=min_amount, max_amount=max_amount, review_filter=review_filter,
        )
        total = query.count()
        rows = query.order_by(Document.created_at.desc()).limit(limit).offset(offset).all()
        return {"total": total, "items": [doc_summary(row) for row in rows]}
    finally:
        db.close()
