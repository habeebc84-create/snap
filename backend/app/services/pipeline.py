"""The SecureDoc AI processing pipeline.

    validate file → preprocess → OCR → classify → extract → validate → persist

Each stage updates `documents.status` so the UI can poll real progress.
Background execution uses FastAPI BackgroundTasks; the interface
(`Pipeline.run(document_id)`) is intentionally plain so Celery/RQ can replace
the executor later without touching the pipeline itself.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict

from sqlalchemy.orm import Session

from app.config import settings as app_settings
from app.database.session import SessionLocal
from app.models import (
    Classification,
    Document,
    DocumentPage,
    ExtractedField,
    LineItem,
    OcrResult,
    ValidationResult,
)
from app.services.audit import log_action
from app.services.classification.base import DocumentClassifier, get_classifier
from app.services.confidence import overall_confidence, score_field, validation_component
from app.services.extraction.base import DocumentExtractor, get_extractor
from app.services.ocr.base import OCRProvider, get_ocr_provider
from app.services.preprocessing.preprocessor import Preprocessor
from app.services.settings_service import get_settings
from app.services.validation.validator import validate_document, validate_line_items
from app.utils.errors import AppError, OCRError

logger = logging.getLogger("securedoc.pipeline")

PIPELINE_STATES = [
    "uploaded", "queued", "preprocessing", "ocr", "classifying",
    "extracting", "validating", "completed", "needs_review", "failed",
]
ACTIVE_STATES = {"uploaded", "queued", "preprocessing", "ocr", "classifying", "extracting", "validating"}


class Pipeline:
    """Runs the full document pipeline for a single document."""

    def __init__(
        self,
        ocr_provider: OCRProvider | None = None,
        classifier: DocumentClassifier | None = None,
        extractor: DocumentExtractor | None = None,
        preprocessor: Preprocessor | None = None,
    ):
        self.ocr_provider = ocr_provider
        self.classifier = classifier
        self.extractor = extractor
        self.preprocessor = preprocessor or Preprocessor()

    @staticmethod
    def _set_status(db: Session, document: Document, status: str) -> None:
        document.status = status
        db.commit()

    def run(self, document_id: str, confidence_threshold: float | None = None) -> None:
        """Entry point for background execution. Owns its own DB session."""
        db = SessionLocal()
        try:
            if confidence_threshold is None:
                confidence_threshold = float(get_settings(db)["confidence_threshold"])
            self._run(db, document_id, confidence_threshold)
        finally:
            db.close()

    # ------------------------------------------------------------------ stages
    def _run(self, db: Session, document_id: str, confidence_threshold: float) -> None:
        document = db.get(Document, document_id)
        if document is None:
            return
        started = time.perf_counter()
        try:
            # 1) PREPROCESS ---------------------------------------------------
            self._set_status(db, document, "preprocessing")
            pages = self.preprocessor.prepare(document.file_path, document.file_type, document.id)
            db.query(DocumentPage).filter(DocumentPage.document_id == document.id).delete()
            for page in pages:
                db.add(
                    DocumentPage(
                        document_id=document.id,
                        page_number=page.page_number,
                        image_path=page.image_path,
                        width=page.width,
                        height=page.height,
                    )
                )
            document.page_count = len(pages)
            db.commit()

            # 2) OCR ------------------------------------------------------------
            self._set_status(db, document, "ocr")
            provider = self.ocr_provider or get_ocr_provider(app_settings.ocr_lang)
            page_results = []
            for page in pages:
                result = provider.extract_text(page.image_path)
                page_results.append((page.page_number, result))
                db.add(
                    OcrResult(
                        document_id=document.id,
                        page_number=page.page_number,
                        text=result.text,
                        language=result.language,
                        confidence=result.confidence,
                        boxes_json=json.dumps([asdict(box) for box in result.boxes[:2000]]),
                    )
                )
            db.commit()

            full_text = "\n".join(result.text for _, result in page_results).strip()
            confidences = [result.confidence for _, result in page_results if result.confidence > 0]
            ocr_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            if not full_text:
                raise OCRError("We couldn't find any readable text in this document.")
            log_action(
                db, "ocr_completed", entity_type="document", entity_id=document.id,
                detail=f"{len(page_results)} page(s), engine={getattr(provider, 'name', 'ocr')}",
            )

            # 3) CLASSIFY --------------------------------------------------------
            self._set_status(db, document, "classifying")
            classifier = self.classifier or get_classifier()
            classification = classifier.classify(full_text)
            db.add(
                Classification(
                    document_id=document.id,
                    document_type=classification.document_type,
                    confidence=classification.confidence,
                    model_name=classification.model,
                )
            )
            document.document_type = classification.document_type
            db.commit()
            log_action(
                db, "classification_completed", entity_type="document", entity_id=document.id,
                detail=f"model={classification.model}",
            )

            # 4) EXTRACT ----------------------------------------------------------
            self._set_status(db, document, "extracting")
            extractor = self.extractor or get_extractor(classification.document_type)
            extraction = extractor.extract(full_text, classification.document_type)

            db.query(ExtractedField).filter(ExtractedField.document_id == document.id).delete()
            db.query(LineItem).filter(LineItem.document_id == document.id).delete()
            for field_value in extraction.fields.values():
                db.add(
                    ExtractedField(
                        document_id=document.id,
                        field_name=field_value.name,
                        value=field_value.value,
                        confidence=field_value.confidence,
                        source=field_value.source,
                    )
                )
            for position, item in enumerate(extraction.line_items):
                db.add(
                    LineItem(
                        document_id=document.id,
                        position=position,
                        description=item.description,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        tax=item.tax,
                        total=item.total,
                    )
                )
            db.commit()
            log_action(
                db, "extraction_completed", entity_type="document", entity_id=document.id,
                detail=f"{len(extraction.fields)} fields, {len(extraction.line_items)} items",
            )

            # 5) VALIDATE ------------------------------------------------------------
            self._set_status(db, document, "validating")
            rules = validate_document(classification.document_type, extraction.fields)
            line_rule = validate_line_items(
                extraction.line_items, _numeric_field(extraction.fields, "total")
            )
            if line_rule:
                rules.append(line_rule)
            rule_dicts = [rule.to_dict() for rule in rules]

            db.query(ValidationResult).filter(ValidationResult.document_id == document.id).delete()
            for rule in rules:
                db.add(
                    ValidationResult(
                        document_id=document.id,
                        rule=rule.rule,
                        passed=rule.passed,
                        message=rule.message,
                        severity=rule.severity,
                        details_json=json.dumps(
                            {"fields": rule.fields, "severity": rule.severity, **rule.details}
                        ),
                    )
                )

            # 6) CONFIDENCE ------------------------------------------------------------
            field_scores: list[float] = []
            for field_entry in db.query(ExtractedField).filter(ExtractedField.document_id == document.id):
                components = {
                    "ocr": ocr_confidence,
                    "model": classification.confidence,
                    "pattern": field_entry.confidence,
                    "validation": validation_component(rule_dicts, field_entry.field_name),
                }
                field_entry.confidence = score_field(components)
                field_scores.append(field_entry.confidence)

            document.overall_confidence = overall_confidence(field_scores, classification.confidence)

            has_blocking_failure = any(
                not rule.passed and rule.severity == "error" for rule in rules
            )
            needs_review = (
                has_blocking_failure
                or classification.confidence < confidence_threshold
                or document.overall_confidence < confidence_threshold
            )

            document.processing_time_ms = int((time.perf_counter() - started) * 1000)
            document.error_message = None
            self._set_status(db, document, "needs_review" if needs_review else "completed")

            log_action(
                db, "validation_completed", entity_type="document", entity_id=document.id,
                detail=f"{sum(1 for r in rules if r.passed)}/{len(rules)} rules passed",
            )
            log_action(
                db, "document_processed", entity_type="document", entity_id=document.id,
                detail=f"status={'needs_review' if needs_review else 'completed'}, "
                       f"ms={document.processing_time_ms}",
            )

        except AppError as exc:
            self._fail(db, document, exc.message, exc.code, started)
        except Exception:  # unexpected — never leak a stack trace to the client
            logger.exception("pipeline_failed document=%s", document_id)
            self._fail(db, document, "We couldn't process this document.", "processing_failed", started)

    @staticmethod
    def _fail(db: Session, document: Document, message: str, code: str, started: float) -> None:
        try:
            document.status = "failed"
            document.error_message = message
            document.processing_time_ms = int((time.perf_counter() - started) * 1000)
            db.commit()
            log_action(db, "processing_failed", entity_type="document", entity_id=document.id, detail=code)
        except Exception:
            logger.exception("failed to persist failure state")


def _numeric_field(fields: dict, name: str) -> float | None:
    from app.services.extraction.patterns import parse_number

    entry = fields.get(name)
    if not entry:
        return None
    return parse_number(entry.value)
