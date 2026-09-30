"""Document endpoints: upload, list, detail, process, review, delete, demo."""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import doc_detail, doc_summary
from app.config import settings as app_settings
from app.database.session import SessionLocal
from app.models import Classification, Document, ExtractedField, ReviewAction
from app.schemas import DocumentDetail, DocumentSummary, ReviewIn, SearchResult, StatusOut
from app.security.files import delete_stored, store_document, validate_upload
from app.services.audit import log_action
from app.services.confidence import confidence_band, overall_confidence
from app.services.pipeline import ACTIVE_STATES, Pipeline
from app.services.preprocessing.preprocessor import Preprocessor
from app.services.settings_service import get_settings as read_settings
from app.utils.errors import NotFoundError

logger = logging.getLogger("securedoc.api")
router = APIRouter(prefix="/api/documents", tags=["documents"])


def _get(db: Session, document_id: str) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document")
    return document


@router.post("/upload", response_model=DocumentSummary, status_code=201)
async def upload_document(file: UploadFile = File(...)) -> dict:
    """Validate + store the file locally. Nothing leaves this machine."""
    content = await file.read()
    filename, detected = validate_upload(filename=file.filename, content=content)
    document_id, stored_path = store_document(content, detected)

    db = SessionLocal()
    try:
        document = Document(
            id=document_id,
            filename=filename,
            file_path=str(stored_path),
            file_type=detected,
            file_size=len(content),
            status="uploaded",
        )
        db.add(document)
        db.commit()
        log_action(
            db, "document_imported", entity_type="document", entity_id=document_id,
            detail=f"type={detected}, bytes={len(content)}",
        )
        db.refresh(document)
        return doc_summary(document)
    finally:
        db.close()


@router.get("", response_model=SearchResult)
def list_documents(
    document_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    needs_review: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    from app.api.search import build_document_query

    db = SessionLocal()
    try:
        query = build_document_query(db, document_type=document_type, status=status,
                                     needs_review=needs_review)
        total = query.count()
        rows = query.order_by(Document.created_at.desc()).limit(limit).offset(offset).all()
        return {"total": total, "items": [doc_summary(row) for row in rows]}
    finally:
        db.close()


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str) -> dict:
    db = SessionLocal()
    try:
        return doc_detail(db, _get(db, document_id))
    finally:
        db.close()


@router.get("/{document_id}/status", response_model=StatusOut)
def document_status(document_id: str) -> dict:
    db = SessionLocal()
    try:
        document = _get(db, document_id)
        return {
            "id": document.id,
            "status": document.status,
            "document_type": document.document_type or "unclassified",
            "overall_confidence": round(float(document.overall_confidence or 0), 4),
            "page_count": document.page_count or 0,
            "error_message": document.error_message,
            "updated_at": document.updated_at.isoformat() if document.updated_at else "",
        }
    finally:
        db.close()


@router.post("/{document_id}/process")
def process_document(document_id: str, background_tasks: BackgroundTasks) -> dict:
    """Queue the full local pipeline for this document."""
    db = SessionLocal()
    try:
        document = _get(db, document_id)
        if document.status in ACTIVE_STATES and document.status != "uploaded":
            return {"id": document.id, "status": document.status, "queued": False}
        document.status = "queued"
        document.error_message = None
        db.commit()
        background_tasks.add_task(Pipeline().run, document.id)
        return {"id": document.id, "status": "queued", "queued": True}
    finally:
        db.close()


@router.post("/{document_id}/review")
def review_document(document_id: str, payload: ReviewIn) -> dict:
    """Human correction of extracted values. Corrections persist locally."""
    db = SessionLocal()
    try:
        document = _get(db, document_id)
        saved: list[str] = []
        for item in payload.fields:
            field_name = item.field_name.strip()
            new_value = item.value.strip()
            row = (
                db.query(ExtractedField)
                .filter(ExtractedField.document_id == document.id,
                        ExtractedField.field_name == field_name)
                .first()
            )
            if row is None:
                row = ExtractedField(
                    document_id=document.id, field_name=field_name,
                    value=new_value, confidence=1.0, source="manual",
                    original_value="", is_corrected=bool(new_value),
                )
                db.add(row)
            else:
                if row.original_value is None:
                    row.original_value = row.value or ""
                if row.value != new_value:
                    row.is_corrected = True
                row.value = new_value
                row.confidence = 1.0  # human-confirmed
                if row.source == "manual":
                    row.source = "manual"
            db.add(
                ReviewAction(
                    document_id=document.id, field_name=field_name,
                    original_value=row.original_value or "", new_value=new_value,
                )
            )
            saved.append(field_name)
        db.commit()

        log_action(db, "field_edited", entity_type="document", entity_id=document.id,
                   detail=f"{len(saved)} field(s)")

        # Re-evaluate overall confidence / review state after human correction.
        classification = (
            db.query(Classification)
            .filter(Classification.document_id == document.id)
            .order_by(Classification.id.desc())
            .first()
        )
        scores = [float(f.confidence or 0) for f in
                  db.query(ExtractedField).filter(ExtractedField.document_id == document.id)]
        class_conf = float(classification.confidence) if classification else 0.5
        document.overall_confidence = overall_confidence(scores, class_conf)

        from app.models import ValidationResult

        blocking = any(
            (not v.passed) and v.severity == "error"
            for v in db.query(ValidationResult).filter(ValidationResult.document_id == document.id)
        )
        if document.status in {"needs_review", "completed"} and not blocking:
            threshold = float(read_settings(db)["confidence_threshold"])
            document.status = (
                "completed" if document.overall_confidence >= threshold else "needs_review"
            )
        db.commit()
        return doc_detail(db, document)
    finally:
        db.close()


@router.delete("/{document_id}")
def delete_document(document_id: str, purge_ocr: bool = Query(default=True)) -> dict:
    """Permanent local deletion: file, processed pages, OCR text, extracted data."""
    db = SessionLocal()
    try:
        document = _get(db, document_id)
        file_path = document.file_path
        filename = document.filename
        db.delete(document)  # cascades pages/ocr/fields/line items/validations/reviews
        db.commit()

        delete_stored(file_path)
        Preprocessor().cleanup(document_id)
        log_action(
            db, "document_deleted", entity_type="document", entity_id=document_id,
            detail=f"purge_ocr={purge_ocr}",
        )
        return {"id": document_id, "deleted": True, "filename": filename}
    finally:
        db.close()


@router.get("/{document_id}/pages/{page_number}/image")
def page_image(document_id: str, page_number: int):
    from fastapi.responses import FileResponse

    from app.models import DocumentPage
    from app.utils.errors import AppError

    db = SessionLocal()
    try:
        _get(db, document_id)
        row = (
            db.query(DocumentPage)
            .filter(DocumentPage.document_id == document_id,
                    DocumentPage.page_number == page_number)
            .first()
        )
        if row is None:
            raise NotFoundError("Page")
        from pathlib import Path

        path = Path(row.image_path).resolve()
        path.relative_to(app_settings.processed_path.resolve())  # containment check
        if not path.exists():
            raise NotFoundError("Page")
        return FileResponse(path, media_type="image/png")
    except ValueError as exc:
        raise AppError("Page image unavailable.", code="not_found", status=404) from exc
    finally:
        db.close()


@router.get("/{document_id}/file")
def original_file(document_id: str):
    from pathlib import Path

    from fastapi.responses import FileResponse

    from app.utils.errors import AppError

    db = SessionLocal()
    try:
        document = _get(db, document_id)
        path = Path(document.file_path).resolve()
        try:
            path.relative_to(app_settings.document_storage_path.resolve())
        except ValueError as exc:
            raise AppError("File unavailable.", code="not_found", status=404) from exc
        if not path.exists():
            raise NotFoundError("File")
        media = {"pdf": "application/pdf", "png": "image/png",
                 "jpg": "image/jpeg", "webp": "image/webp"}.get(document.file_type, "application/octet-stream")
        return FileResponse(path, media_type=media, filename=f"document.{document.file_type}")
    finally:
        db.close()


@router.post("/demo", response_model=SearchResult, status_code=201)
def load_demo_data(background_tasks: BackgroundTasks) -> dict:
    """Generate clearly synthetic demo documents and process them locally."""
    from app.services.demo import generate_demo_documents

    db = SessionLocal()
    try:
        created = generate_demo_documents()
        items = []
        for document_id, filename in created:
            document = Document(
                id=document_id, filename=filename,
                file_path=str(app_settings.document_storage_path / f"{document_id}.pdf"),
                file_type="pdf", status="queued", is_demo=True,
            )
            db.add(document)
            db.commit()
            log_action(db, "document_imported", entity_type="document",
                       entity_id=document_id, detail="demo import")
            background_tasks.add_task(Pipeline().run, document_id)
            items.append(doc_summary(document))
        log_action(db, "demo_data_loaded", entity_type="document", detail=f"{len(items)} documents")
        return {"total": len(items), "items": items}
    finally:
        db.close()
