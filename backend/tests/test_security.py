"""Security: path traversal, malicious filenames, type/size limits, SQLi."""

from __future__ import annotations

import pytest

from app.config import settings as app_settings
from app.security.files import (
    delete_stored,
    safe_original_name,
    sanitized_export_name,
    sniff_type,
    store_document,
    validate_upload,
)
from app.utils.errors import FileTooLargeError, FileValidationError


def test_filename_path_traversal_stripped():
    assert safe_original_name("../../etc/passwd") == "passwd"
    assert safe_original_name("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert safe_original_name("/etc/shadow") == "shadow"
    assert safe_original_name("..") == "document"
    assert safe_original_name("") == "document"
    assert safe_original_name(None) == "document"


def test_filename_control_chars_and_xss_stripped():
    assert safe_original_name("invoice\x00.png") == "invoice.png"
    cleaned = safe_original_name("<script>alert(1)</script>.png")
    assert "<" not in cleaned and ">" not in cleaned and "/" not in cleaned
    assert "\n" not in safe_original_name("bad\nname.png")


def test_magic_bytes_decide_type():
    assert sniff_type(b"%PDF-1.4 rest") == "pdf"
    assert sniff_type(b"\x89PNG\r\n\x1a\nrest") == "png"
    assert sniff_type(b"\xff\xd8\xff\xe0rest") == "jpg"
    assert sniff_type(b"RIFF\x00\x00\x00\x00WEBP") == "webp"
    assert sniff_type(b"MZ\x90\x00 executable") is None


def test_extension_spoofing_rejected():
    """An .exe renamed to .pdf still fails the magic-byte check."""
    with pytest.raises(FileValidationError):
        validate_upload(filename="invoice.pdf", content=b"MZ\x90\x00 not a pdf")


def test_declared_extension_does_not_override_magic():
    name, detected = validate_upload(filename="scan.pdf", content=b"\x89PNG\r\n\x1a\nDATA")
    assert detected == "png"
    assert name == "scan.pdf"


def test_empty_upload_rejected():
    with pytest.raises(FileValidationError):
        validate_upload(filename="a.png", content=b"")


def test_oversized_upload_rejected(monkeypatch):
    monkeypatch.setattr(app_settings, "max_upload_mb", 1)
    payload = b"%PDF" + b"0" * (1024 * 1024 + 10)
    with pytest.raises(FileTooLargeError):
        validate_upload(filename="big.pdf", content=payload)


def test_storage_path_uses_generated_uuid():
    document_id, path = store_document(b"%PDF-1.4 fake", "pdf")
    try:
        assert len(document_id) == 32
        assert path.name == f"{document_id}.pdf"
        assert path.parent == app_settings.document_storage_path
        assert document_id in path.name
    finally:
        path.unlink(missing_ok=True)


def test_delete_stored_refuses_paths_outside_storage(tmp_path):
    outside = tmp_path / "victim.txt"
    outside.write_text("data")
    assert delete_stored(str(outside)) is False
    assert outside.exists()


def test_export_filename_sanitized():
    name = sanitized_export_name("abc123", "invoice/../etc", "json")
    assert name.startswith("securedoc_")
    assert name.endswith(".json")
    assert "/" not in name and ".." not in name
    weird = sanitized_export_name("abc123", "", "pdf; drop")
    assert weird.startswith("securedoc_")
    assert ";" not in weird and "/" not in weird


def test_upload_endpoint_rejects_traversal_document_id(client):
    assert client.get("/api/documents/../../etc/passwd").status_code in (400, 404, 422)
    assert client.delete("/api/documents/%2e%2e%2fetc").status_code in (400, 404, 422)


def test_settings_validation_rejects_bad_input(client):
    response = client.put("/api/settings", json={"confidence_threshold": 3.5})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert "Traceback" not in response.text


def test_review_input_is_validated(client):
    response = client.post("/api/documents/x/review", json={"fields": []})
    assert response.status_code == 422


def test_page_image_path_contained(client, fake_ocr):
    from conftest import INVOICE_TEXT, make_png, process_document, upload_document

    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])
    response = client.get(f"/api/documents/{document['id']}/pages/1/image")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

    traversal = client.get(f"/api/documents/{document['id']}/pages/1/image?x=../..")
    assert traversal.status_code in (200, 404)
