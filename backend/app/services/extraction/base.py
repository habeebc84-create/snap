"""Extractor abstraction + dispatch. New document types plug in here."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.extraction.common import ExtractionResult
from app.services.extraction.invoice import InvoiceExtractor
from app.services.extraction.receipt import GenericExtractor, ReceiptExtractor


class DocumentExtractor(ABC):
    document_type: str = "other"

    @abstractmethod
    def extract(self, text: str, document_type: str) -> ExtractionResult:
        """Extract structured fields from OCR text for a given document type."""


class InvoiceDocumentExtractor(DocumentExtractor):
    document_type = "invoice"
    _impl = InvoiceExtractor()

    def extract(self, text: str, document_type: str = "invoice") -> ExtractionResult:
        return self._impl.extract(text, document_type)


class ReceiptDocumentExtractor(DocumentExtractor):
    document_type = "receipt"
    _impl = ReceiptExtractor()

    def extract(self, text: str, document_type: str = "receipt") -> ExtractionResult:
        return self._impl.extract(text, document_type)


class GenericDocumentExtractor(DocumentExtractor):
    document_type = "other"
    _impl = GenericExtractor()

    def extract(self, text: str, document_type: str = "other") -> ExtractionResult:
        return self._impl.extract(text, document_type)


_EXTRACTORS: dict[str, DocumentExtractor] = {
    "invoice": InvoiceDocumentExtractor(),
    "receipt": ReceiptDocumentExtractor(),
}


def get_extractor(document_type: str) -> DocumentExtractor:
    """Invoice and receipt have dedicated extractors; everything else uses
    the generic extractor so contracts/POs/forms degrade gracefully today and
    can gain dedicated implementations later."""
    return _EXTRACTORS.get(document_type, GenericDocumentExtractor())


def register_extractor(extractor: DocumentExtractor) -> None:
    _EXTRACTORS[extractor.document_type] = extractor
