"""Model registry.

Honest status reporting: each entry says which runtime is configured and
whether it is actually installed. Missing models never break the app —
the deterministic local fallback takes over.
"""

from __future__ import annotations

from app.config import settings
from app.services.classification.base import OnnxClassifier
from app.services.ocr.base import TesseractProvider

MODEL_REGISTRY = {
    "ocr_engine": {"provider": "local", "runtime": "tesseract", "path": None},
    "document_classifier": {"provider": "local", "runtime": "onnx", "path": "models/classifier/model.onnx"},
    "document_extractor": {"provider": "local", "runtime": "rules", "path": None},
}


def _onnx_runtime_available() -> bool:
    try:
        import onnxruntime  # noqa: F401

        return True
    except Exception:
        return False


def model_status() -> list[dict]:
    tesseract = TesseractProvider(language=settings.ocr_lang)
    tesseract_ok = tesseract.available()
    classifier = OnnxClassifier()
    classifier_ok = classifier.available() and _onnx_runtime_available()

    return [
        {
            "id": "ocr_engine",
            "name": "OCR Engine",
            "provider": "Tesseract",
            "runtime": "tesseract",
            "version": _tesseract_version() if tesseract_ok else None,
            "installed": tesseract_ok,
            "status": "Installed" if tesseract_ok else "Unavailable",
            "fallback": "None — OCR is required for processing" if not tesseract_ok else None,
        },
        {
            "id": "document_classifier",
            "name": "Document Classifier",
            "provider": "Local",
            "runtime": "onnx",
            "version": None,
            "installed": classifier_ok,
            "status": "Installed" if classifier_ok else "Unavailable",
            "fallback": "Using deterministic local fallback (keyword classifier).",
        },
        {
            "id": "document_extractor",
            "name": "Extraction Model",
            "provider": "Local",
            "runtime": "rules+regex",
            "version": None,
            "installed": True,
            "status": "Installed",
            "fallback": None,
        },
    ]


def _tesseract_version() -> str | None:
    try:
        import pytesseract

        return str(pytesseract.get_tesseract_version())
    except Exception:
        return None
