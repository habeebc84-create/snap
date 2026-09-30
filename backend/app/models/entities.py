"""SQLAlchemy ORM entities for SecureDoc AI (local SQLite)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(32), primary_key=True)
    filename = Column(String(255), nullable=False)          # original name, metadata only
    file_path = Column(String(512), nullable=False)         # generated safe path
    file_type = Column(String(16), nullable=False)          # pdf / png / jpg / webp
    file_size = Column(Integer, default=0)
    document_type = Column(String(32), default="unclassified", index=True)
    status = Column(String(32), default="uploaded", index=True)
    page_count = Column(Integer, default=0)
    overall_confidence = Column(Float, default=0.0)
    processing_time_ms = Column(Integer, default=0)
    error_message = Column(Text, default=None)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    ocr_results = relationship("OcrResult", back_populates="document", cascade="all, delete-orphan")
    classifications = relationship(
        "Classification", back_populates="document", cascade="all, delete-orphan"
    )
    fields = relationship(
        "ExtractedField", back_populates="document", cascade="all, delete-orphan"
    )
    line_items = relationship("LineItem", back_populates="document", cascade="all, delete-orphan")
    validations = relationship(
        "ValidationResult", back_populates="document", cascade="all, delete-orphan"
    )
    review_actions = relationship(
        "ReviewAction", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    page_number = Column(Integer, default=1)
    image_path = Column(String(512))
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)

    document = relationship("Document", back_populates="pages")


class OcrResult(Base):
    __tablename__ = "ocr_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    page_number = Column(Integer, default=1)
    text = Column(Text, default="")
    language = Column(String(16), default="eng")
    confidence = Column(Float, default=0.0)
    boxes_json = Column(Text, default="[]")  # word boxes for future field highlighting

    document = relationship("Document", back_populates="ocr_results")


class Classification(Base):
    __tablename__ = "classifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    document_type = Column(String(32), nullable=False)
    confidence = Column(Float, default=0.0)
    model_name = Column(String(64), default="heuristic")
    created_at = Column(DateTime, default=utcnow)

    document = relationship("Document", back_populates="classifications")


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    __table_args__ = (UniqueConstraint("document_id", "field_name", name="uq_doc_field"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    field_name = Column(String(64), nullable=False)
    value = Column(Text, default="")
    original_value = Column(Text, default=None)   # preserved AI value when corrected
    confidence = Column(Float, default=0.0)
    source = Column(String(32), default="pattern")
    is_corrected = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    document = relationship("Document", back_populates="fields")


class LineItem(Base):
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    position = Column(Integer, default=0)
    description = Column(String(255), default="")
    quantity = Column(Float, default=0.0)
    unit_price = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, default=0.0)

    document = relationship("Document", back_populates="line_items")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    rule = Column(String(64), nullable=False)
    passed = Column(Boolean, default=False)
    message = Column(Text, default="")
    severity = Column(String(16), default="error")
    details_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=utcnow)

    document = relationship("Document", back_populates="validations")


class ReviewAction(Base):
    __tablename__ = "review_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    field_name = Column(String(64), nullable=False)
    original_value = Column(Text, default="")
    new_value = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)

    document = relationship("Document", back_populates="review_actions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(64), nullable=False, index=True)
    entity_type = Column(String(32), default="")
    entity_id = Column(String(64), default="")
    detail = Column(String(255), default="")  # non-sensitive context only
    created_at = Column(DateTime, default=utcnow, index=True)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(64), primary_key=True)
    value = Column(Text, default="")
