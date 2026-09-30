"""Pytest fixtures — isolated temp database/storage, app client, OCR helpers.

Environment is configured BEFORE any app import so settings pick it up.
"""

from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path

_TMP = tempfile.mkdtemp(prefix="securedoc_test_")
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["DOCUMENT_STORAGE_PATH"] = f"{_TMP}/documents"
os.environ["PROCESSED_PATH"] = f"{_TMP}/processed"
os.environ["EXPORTS_PATH"] = f"{_TMP}/exports"
os.environ["MODEL_PATH"] = f"{_TMP}/models"

import pytest  # noqa: E402

from app.database.session import Base, engine, init_db  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database():
    init_db()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


# --------------------------------------------------------------------------- images
def make_png(width: int = 700, height: int = 900, color: int = 255) -> bytes:
    from PIL import Image, ImageDraw

    image = Image.new("L", (width, height), color=color)
    draw = ImageDraw.Draw(image)
    draw.rectangle([40, 40, width - 40, height - 40], outline=0, width=3)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def make_pdf(text: str = "Hello document") -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    canvas_obj = canvas.Canvas(buffer, pagesize=letter)
    canvas_obj.setFont("Helvetica", 14)
    canvas_obj.drawString(72, 700, text)
    canvas_obj.save()
    return buffer.getvalue()


INVOICE_TEXT = """ACME TRADERS
Tax Invoice
Invoice No: INV-2026-1042
Invoice Date: 25 Sep 2026
Due Date: 25 Oct 2026
Bill To:
Nimbus Retail Pvt Ltd
42 MG Road, Bengaluru 560001
GSTIN: 27AAACA1234A1Z5
Description Qty Rate Tax% Amount
Cement Bags 20 420.00 18 9912.00
Subtotal 11,000.00
Tax (18%) 1,980.00
Grand Total 12,980.00
Payment Terms: Net 30
"""

RECEIPT_TEXT = """QUICKMART STORES
Receipt No: RCP-88213
Date: 26/09/2026
Time: 14:35
Fresh Milk 1L 2 62.00 124.00
Subtotal 169.00
Tax 6.00
Total 170.00
Payment Method: UPI
"""


@pytest.fixture()
def fake_ocr(monkeypatch):
    """Route the pipeline through a deterministic OCR stub (no engine needed)."""
    from app.services.ocr.base import StaticOCRProvider

    def _install(text: str = INVOICE_TEXT, confidence: float = 0.92):
        provider = StaticOCRProvider(text=text, confidence=confidence)
        monkeypatch.setattr(
            "app.services.pipeline.get_ocr_provider", lambda *a, **k: provider
        )
        return provider

    return _install


def upload_document(client, content: bytes, filename: str = "invoice.png") -> dict:
    response = client.post(
        "/api/documents/upload",
        files={"file": (filename, content, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def process_document(client, document_id: str) -> dict:
    response = client.post(f"/api/documents/{document_id}/process")
    assert response.status_code == 200, response.text
    return response.json()
