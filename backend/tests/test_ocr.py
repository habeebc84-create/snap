"""OCR abstraction contract + real Tesseract smoke test."""

from __future__ import annotations

import io

import pytest

from app.services.ocr.base import (
    OCRProvider,
    OCRResult,
    StaticOCRProvider,
    TesseractProvider,
    get_ocr_provider,
)


def _tesseract_available() -> bool:
    return TesseractProvider().available()


def test_provider_contract():
    """Any OCRProvider must expose extract_text returning an OCRResult."""
    provider = StaticOCRProvider(text="hello", confidence=0.8)
    assert isinstance(provider, OCRProvider)
    result = provider.extract_text("unused.png")
    assert isinstance(result, OCRResult)
    assert result.text == "hello"
    assert result.confidence == 0.8
    assert result.pages == 1
    payload = result.to_dict()
    assert set(payload) >= {"text", "language", "confidence", "pages"}


def test_factory_returns_provider():
    provider = get_ocr_provider("eng")
    assert isinstance(provider, OCRProvider)


@pytest.mark.skipif(not _tesseract_available(), reason="tesseract binary not installed")
def test_tesseract_reads_generated_text():
    """Real OCR: render big text, run Tesseract, expect the words back."""
    from PIL import Image, ImageDraw

    image = Image.new("L", (1200, 300), color=255)
    draw = ImageDraw.Draw(image)
    try:
        from PIL import ImageFont

        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64
        )
    except OSError:  # pragma: no cover
        font = None
    draw.text((40, 100), "INVOICE INV-2026-1042", fill=0, font=font)

    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
        image.save(handle.name)
        path = handle.name

    provider = TesseractProvider()
    result = provider.extract_text(path)
    assert "INV-2026-1042" in result.text.replace(" ", "")
    assert 0.0 <= result.confidence <= 1.0
    assert result.boxes, "expected word bounding boxes for future field highlighting"


@pytest.mark.skipif(not _tesseract_available(), reason="tesseract binary not installed")
def test_tesseract_blank_image_returns_no_text():
    from PIL import Image

    import tempfile

    image = Image.new("L", (400, 400), color=255)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
        image.save(handle.name)
        path = handle.name

    result = TesseractProvider().extract_text(path)
    assert result.text.strip() == ""
    assert result.confidence == 0.0
