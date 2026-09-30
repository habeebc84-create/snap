"""Database layer: CRUD, cascades, audit log content policy."""

from __future__ import annotations

from app.database.session import SessionLocal
from app.models import AuditLog, Document, ExtractedField, ReviewAction
from app.services.audit import log_action


def _session():
    return SessionLocal()


def test_document_crud_roundtrip():
    db = _session()
    try:
        document = Document(id="t1", filename="a.png", file_path="/tmp/a.png",
                            file_type="png", file_size=10, status="uploaded")
        db.add(document)
        db.commit()

        loaded = db.get(Document, "t1")
        assert loaded is not None
        assert loaded.filename == "a.png"
        assert loaded.created_at is not None

        loaded.status = "completed"
        db.commit()
        assert db.get(Document, "t1").status == "completed"

        db.delete(loaded)
        db.commit()
        assert db.get(Document, "t1") is None
    finally:
        db.close()


def test_cascade_delete_removes_fields():
    db = _session()
    try:
        db.add(Document(id="t2", filename="b.png", file_path="/tmp/b.png",
                        file_type="png", file_size=10))
        db.commit()
        db.add(ExtractedField(document_id="t2", field_name="total", value="10",
                              confidence=0.9))
        db.commit()
        assert db.query(ExtractedField).count() >= 1

        db.delete(db.get(Document, "t2"))
        db.commit()
        remaining = db.query(ExtractedField).filter(ExtractedField.document_id == "t2").count()
        assert remaining == 0
    finally:
        db.close()


def test_audit_log_records_action_without_content():
    db = _session()
    try:
        entry = log_action(db, "field_edited", entity_type="document",
                           entity_id="t3", detail="invoice_number")
        assert entry.id is not None
        row = db.query(AuditLog).filter(AuditLog.id == entry.id).first()
        assert row.action == "field_edited"
        assert "invoice_number" in row.detail  # field NAME ok
        # The audit layer never receives values — assert the API stays narrow:
        assert not hasattr(row, "value")
    finally:
        db.close()


def test_review_action_tracks_original_and_new():
    db = _session()
    try:
        db.add(Document(id="t4", filename="c.png", file_path="/tmp/c.png",
                        file_type="png", file_size=10))
        db.add(ReviewAction(document_id="t4", field_name="total",
                            original_value="100", new_value="150"))
        db.commit()
        row = db.query(ReviewAction).filter(ReviewAction.document_id == "t4").first()
        assert row.original_value == "100"
        assert row.new_value == "150"
        db.delete(db.get(Document, "t4"))
        db.commit()
    finally:
        db.close()
