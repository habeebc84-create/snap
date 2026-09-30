#!/usr/bin/env python3
"""SecureDoc AI benchmark.

Measures real per-stage latency and peak memory on this machine.
No synthetic or fabricated numbers — every value below is measured at runtime.

Usage:
    .venv/bin/python scripts/benchmark.py [path/to/document.pdf]
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def _peak_memory_mb() -> float:
    """Peak resident memory of this process, in MB (Linux/macOS)."""
    try:
        import resource

        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux reports KB, macOS reports bytes
        return usage / 1024 if sys.platform != "darwin" else usage / (1024 * 1024)
    except Exception:  # pragma: no cover
        return 0.0


def main() -> int:
    from app.config import settings
    from app.database.session import init_db, SessionLocal
    from app.services.classification.base import get_classifier
    from app.services.extraction.base import get_extractor
    from app.services.ocr.base import get_ocr_provider
    from app.services.preprocessing.preprocessor import Preprocessor
    from app.services.validation.validator import validate_document

    init_db()
    db = SessionLocal()

    # Choose the benchmark document: a provided path, or generate a demo invoice.
    if len(sys.argv) > 1:
        document_path = Path(sys.argv[1])
        file_type = document_path.suffix.lstrip(".").lower()
        if file_type == "jpeg":
            file_type = "jpg"
        label = document_path.name
    else:
        from app.services.demo import generate_demo_documents

        created = generate_demo_documents()
        document_id, filename = created[0]
        document_path = settings.document_storage_path / f"{document_id}.pdf"
        file_type = "pdf"
        label = f"{filename} (synthetic demo)"

    bench_id = f"bench_{int(time.time())}"
    total_started = time.perf_counter()

    # 1) Preprocessing -------------------------------------------------------
    started = time.perf_counter()
    preprocessor = Preprocessor()
    pages = preprocessor.prepare(str(document_path), file_type, bench_id)
    preprocess_ms = (time.perf_counter() - started) * 1000

    # 2) OCR -----------------------------------------------------------------
    started = time.perf_counter()
    provider = get_ocr_provider(settings.ocr_lang)
    results = [provider.extract_text(page.image_path) for page in pages]
    ocr_ms = (time.perf_counter() - started) * 1000
    full_text = "\n".join(result.text for result in results)
    ocr_confidence = (
        sum(result.confidence for result in results) / len(results) if results else 0.0
    )

    # 3) Classification --------------------------------------------------------
    started = time.perf_counter()
    classifier = get_classifier()
    classification = classifier.classify(full_text)
    classify_ms = (time.perf_counter() - started) * 1000

    # 4) Extraction ------------------------------------------------------------
    started = time.perf_counter()
    extractor = get_extractor(classification.document_type)
    extraction = extractor.extract(full_text, classification.document_type)
    extract_ms = (time.perf_counter() - started) * 1000

    # 5) Validation --------------------------------------------------------------
    started = time.perf_counter()
    rules = validate_document(classification.document_type, extraction.fields)
    validate_ms = (time.perf_counter() - started) * 1000

    total_ms = (time.perf_counter() - total_started) * 1000

    preprocessor.cleanup(bench_id)
    db.close()

    engine = getattr(provider, "name", type(provider).__name__)
    print()
    print("SECUREDOC AI BENCHMARK")
    print("=" * 46)
    print(f"Document:        {label}")
    print(f"OCR engine:      {engine}")
    print(f"Classifier:      {classification.model} ({classification.document_type}, "
          f"{classification.confidence:.2f})")
    print(f"Pages:           {len(pages)}")
    print(f"OCR words:       {len(full_text.split())} (confidence {ocr_confidence:.2f})")
    print(f"Fields extracted:{len(extraction.fields):>3}")
    print("-" * 46)
    print(f"Preprocessing:   {preprocess_ms:6.0f} ms")
    print(f"OCR:             {ocr_ms:6.0f} ms")
    print(f"Classification:  {classify_ms:6.0f} ms")
    print(f"Extraction:      {extract_ms:6.0f} ms")
    print(f"Validation:      {validate_ms:6.0f} ms")
    print("-" * 46)
    print(f"Total:           {total_ms:6.0f} ms")
    print(f"Memory (peak):   {_peak_memory_mb():6.0f} MB")
    print()
    print("Notes:")
    print("  - Measurements are local CPU values; no NPU/Snapdragon acceleration")
    print("    is claimed or active in this environment.")
    print("  - To deploy on Snapdragon, swap the ONNX Runtime provider and use")
    print("    quantized models; see README 'Snapdragon deployment'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
