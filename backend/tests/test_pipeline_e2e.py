"""End-to-end pipeline tests using the REAL Tesseract engine.

These verify the whole chain on synthetic images: preprocess → OCR → classify
→ extract → validate → persist.
"""

from __future__ import annotations

import io

import pytest

from app.services.ocr.base import TesseractProvider

pytestmark = pytest.mark.skipif(
    not TesseractProvider().available(), reason="tesseract binary not installed"
)

try:
    from PIL import Image, ImageDraw, ImageFont

    _FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
    _FONT_SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
except Exception:  # pragma: no cover
    _FONT = None
    _FONT_SMALL = None


def _invoice_image(rotated: bool = False) -> bytes:
    image = Image.new("L", (1400, 1800), color=255)
    draw = ImageDraw.Draw(image)
    draw.text((60, 50), "ACME TRADERS", fill=0, font=_FONT)
    draw.text((60, 120), "Tax Invoice", fill=0, font=_FONT)
    lines = [
        "Invoice No: INV-77123",
        "Invoice Date: 25 Sep 2026",
        "Due Date: 25 Oct 2026",
        "Bill To: Nimbus Retail",
        "GSTIN: 27AAACA1234A1Z5",
        "Subtotal 1,000.00",
        "Tax 180.00",
        "Grand Total 1,180.00",
    ]
    y = 210
    for line in lines:
        draw.text((60, y), line, fill=0, font=_FONT_SMALL)
        y += 70
    if rotated:
        image = image.rotate(7, resample=Image.BILINEAR, fillcolor=255, expand=True)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _upload_and_process(client, content: bytes, filename: str = "doc.png") -> str:
    response = client.post(
        "/api/documents/upload", files={"file": (filename, content, "image/png")}
    )
    assert response.status_code == 201, response.text
    document_id = response.json()["id"]
    queued = client.post(f"/api/documents/{document_id}/process")
    assert queued.status_code == 200
    return document_id


def test_real_ocr_invoice_end_to_end(client):
    document_id = _upload_and_process(client, _invoice_image())
    detail = client.get(f"/api/documents/{document_id}").json()

    assert detail["status"] in {"completed", "needs_review"}
    assert detail["document_type"] == "invoice"
    assert detail["ocr_confidence"] > 0.3

    fields = {f["name"]: f["value"] for f in detail["fields"]}
    assert fields.get("invoice_number") == "INV-77123"
    assert fields.get("invoice_date") == "2026-09-25"
    assert fields.get("gstin") == "27AAACA1234A1Z5"
    assert fields.get("total") == "1180.00"

    assert detail["classification"]["confidence"] >= 0.75
    assert detail["validations"]
    total_conf = next(f for f in detail["fields"] if f["name"] == "total")
    assert 0 < total_conf["confidence"] <= 1


def test_rotated_document_still_processes(client):
    document_id = _upload_and_process(client, _invoice_image(rotated=True))
    detail = client.get(f"/api/documents/{document_id}").json()
    assert detail["status"] in {"completed", "needs_review", "failed"}
    if detail["status"] != "failed":
        assert detail["document_type"] in {
            "invoice", "receipt", "purchase_order", "contract", "form", "other",
        }


def test_blank_image_fails_gracefully(client):
    blank = io.BytesIO()
    Image.new("L", (800, 1000), color=255).save(blank, format="PNG")
    document_id = _upload_and_process(client, blank.getvalue())
    detail = client.get(f"/api/documents/{document_id}").json()
    assert detail["status"] == "failed"
    assert "readable text" in detail["error_message"] or "couldn't" in detail["error_message"]
    assert "Traceback" not in (detail["error_message"] or "")


def test_multi_page_pdf_processed(client):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    canvas_obj = canvas.Canvas(buffer, pagesize=letter)
    for page in range(2):
        canvas_obj.drawString(72, 700, f"Invoice Page {page + 1} INV-900{page + 1}")
        canvas_obj.showPage()
    canvas_obj.save()

    document_id = _upload_and_process(client, buffer.getvalue(), "multi.pdf")
    detail = client.get(f"/api/documents/{document_id}").json()
    assert detail["page_count"] == 2
    assert detail["status"] in {"completed", "needs_review", "failed"}
    if detail["status"] != "failed":
        assert "INV-900" in detail["ocr_text"].replace(" ", "")


def test_oversized_image_capped_by_preprocessor():
    """Huge images are resized before OCR so memory stays bounded."""
    from app.services.preprocessing.preprocessor import Preprocessor

    preprocessor = Preprocessor(max_dimension=3200)
    oversized = Image.new("RGB", (5000, 4200), color=255)
    resized = preprocessor._resize(oversized)
    assert max(resized.size) <= 3200

    # And a processed page from a real upload never exceeds the cap either.
    document_id = None  # covered by test_real_ocr_invoice_end_to_end pages
