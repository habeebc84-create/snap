"""API endpoints: upload → process → review → search → analytics → delete."""

from __future__ import annotations

from conftest import INVOICE_TEXT, RECEIPT_TEXT, make_pdf, make_png, process_document, upload_document


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["offline"] is True


def test_upload_validates_and_stores_locally(client):
    response = client.post(
        "/api/documents/upload",
        files={"file": ("my invoice.png", make_png(), "image/png")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "my invoice.png"  # original name kept as metadata
    assert body["file_type"] == "png"
    assert body["status"] == "uploaded"
    assert len(body["id"]) == 32  # generated id, not the client filename


def test_upload_rejects_unknown_type(client):
    response = client.post(
        "/api/documents/upload",
        files={"file": ("evil.exe", b"MZ\x90\x00 garbage", "application/octet-stream")},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "invalid_file"
    assert "hint" in error


def test_upload_rejects_empty_file(client):
    response = client.post(
        "/api/documents/upload", files={"file": ("empty.png", b"", "image/png")},
    )
    assert response.status_code == 400


def test_full_invoice_workflow(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png(), "invoice.png")
    queued = process_document(client, document["id"])
    assert queued["queued"] is True

    detail = client.get(f"/api/documents/{document['id']}").json()
    assert detail["status"] in {"completed", "needs_review"}
    assert detail["document_type"] == "invoice"
    fields = {f["name"]: f for f in detail["fields"]}
    assert fields["invoice_number"]["value"] == "INV-2026-1042"
    assert 0 < fields["invoice_number"]["confidence"] <= 1
    assert fields["total"]["value"] == "12980.00"
    assert detail["classification"]["confidence"] > 0.5
    assert detail["ocr_text"]
    assert detail["validations"], "expected validation results"
    assert detail["line_items"], "expected line items"


def test_status_endpoint_polling(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])
    status = client.get(f"/api/documents/{document['id']}/status").json()
    assert status["status"] in {"completed", "needs_review"}
    assert "error_message" in status


def test_review_correction_persists(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])

    response = client.post(
        f"/api/documents/{document['id']}/review",
        json={"fields": [{"field_name": "total", "value": "13500.00"}]},
    )
    assert response.status_code == 200

    # Fresh request = fresh session → must still show the correction
    detail = client.get(f"/api/documents/{document['id']}").json()
    field = next(f for f in detail["fields"] if f["name"] == "total")
    assert field["value"] == "13500.00"
    assert field["is_corrected"] is True
    assert field["original_value"] == "12980.00"
    assert detail["review_actions"], "expected an audit trail of the correction"

    audit = client.get("/api/audit-logs", params={"action": "field_edited"}).json()
    assert any(entry["entity_id"] == document["id"] for entry in audit)
    # audit log must not contain the corrected value
    assert "13500" not in str(audit)


def test_review_can_add_missing_field(client, fake_ocr):
    fake_ocr(RECEIPT_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])
    response = client.post(
        f"/api/documents/{document['id']}/review",
        json={"fields": [{"field_name": "payment_method", "value": "Cash"}]},
    )
    assert response.status_code == 200
    fields = {f["name"]: f["value"] for f in response.json()["fields"]}
    assert fields["payment_method"] == "Cash"


def test_search_finds_documents(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png(), "quarterly-bill.png")
    process_document(client, document["id"])

    by_text = client.get("/api/search", params={"q": "INV-2026-1042"}).json()
    assert by_text["total"] >= 1
    assert any(item["id"] == document["id"] for item in by_text["items"])

    by_filename = client.get("/api/search", params={"q": "quarterly"}).json()
    assert by_filename["total"] >= 1

    by_type = client.get("/api/search", params={"document_type": "invoice"}).json()
    assert by_type["total"] >= 1

    # SQL injection attempt must be treated as a literal string
    injected = client.get("/api/search", params={"q": "' OR 1=1; --"}).json()
    assert injected["total"] == 0


def test_search_amount_range(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])
    hit = client.get("/api/search", params={"min_amount": 12000, "max_amount": 14000}).json()
    assert any(item["id"] == document["id"] for item in hit["items"])
    miss = client.get("/api/search", params={"min_amount": 999999}).json()
    assert miss["total"] == 0


def test_analytics_from_database(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])

    analytics = client.get("/api/analytics").json()
    assert analytics["kpis"]["total_documents"] >= 1
    assert analytics["kpis"]["storage_used_bytes"] > 0
    assert any(t["type"] == "invoice" and t["count"] >= 1 for t in analytics["by_type"])
    assert len(analytics["over_time"]) == 30
    assert analytics["totals"]["invoice_value"] >= 12980
    assert 0 <= analytics["confidence"]["average"] <= 1
    assert "avg_processing_ms" in analytics["performance"]


def test_settings_roundtrip_and_consent_gate(client):
    settings = client.get("/api/settings").json()
    assert settings["cloud_processing"] is False
    assert settings["telemetry"] is False
    assert settings["confidence_threshold"] == 0.75

    updated = client.put("/api/settings", json={
        "confidence_threshold": 0.8, "ocr_language": "eng", "theme": "dark",
    }).json()
    assert updated["confidence_threshold"] == 0.8
    assert updated["theme"] == "dark"

    # Enabling cloud processing without consent must fail
    denied = client.put("/api/settings", json={"cloud_processing": True})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "consent_required"

    # With explicit consent it succeeds (privacy default remains off until then)
    allowed = client.put("/api/settings", json={"cloud_processing": True, "consent": True})
    assert allowed.status_code == 200
    assert allowed.json()["cloud_processing"] is True

    # restore privacy defaults
    client.put("/api/settings", json={"cloud_processing": False, "confidence_threshold": 0.75,
                                      "theme": "system"})


def test_security_status_endpoint(client):
    status = client.get("/api/security/status").json()
    assert status["local_processing"] is True
    assert status["no_cloud_upload"] is True
    assert status["audit_logging"] is True
    assert status["offline_mode"] is True
    assert set(status["privacy"]) == {"cloud_processing", "telemetry", "anonymous_analytics"}
    assert status["storage"]["total_bytes"] >= 0


def test_audit_logs_endpoint(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])
    client.delete(f"/api/documents/{document['id']}")

    logs = client.get("/api/audit-logs").json()
    actions = {entry["action"] for entry in logs}
    assert {"document_imported", "document_processed", "document_deleted"} <= actions
    assert all(len(entry["detail"]) <= 255 for entry in logs)


def test_models_endpoint_reports_honest_status(client):
    models = client.get("/api/models").json()
    ids = {m["id"] for m in models}
    assert {"ocr_engine", "document_classifier", "document_extractor"} <= ids
    classifier = next(m for m in models if m["id"] == "document_classifier")
    # ONNX model files aren't shipped → must say unavailable + fallback, not pretend
    if not classifier["installed"]:
        assert classifier["status"] == "Unavailable"
        assert "fallback" in classifier["fallback"].lower()


def test_delete_removes_document_and_file(client, fake_ocr):
    import os

    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_png())
    process_document(client, document["id"])

    detail = client.get(f"/api/documents/{document['id']}").json()
    assert detail["status"] in {"completed", "needs_review"}

    response = client.delete(f"/api/documents/{document['id']}")
    assert response.status_code == 200
    assert response.json()["deleted"] is True

    assert client.get(f"/api/documents/{document['id']}").status_code == 404
    listing = client.get("/api/documents").json()
    assert all(item["id"] != document["id"] for item in listing["items"])


def test_process_missing_document_404(client):
    assert client.post("/api/documents/deadbeef/process").status_code == 404
    assert client.get("/api/documents/deadbeef").status_code == 404


def test_upload_pdf_supported(client, fake_ocr):
    fake_ocr(INVOICE_TEXT)
    document = upload_document(client, make_pdf(), "scan.pdf")
    assert document["file_type"] == "pdf"
    process_document(client, document["id"])
    detail = client.get(f"/api/documents/{document['id']}").json()
    assert detail["status"] in {"completed", "needs_review", "failed"}
    assert detail["page_count"] >= 1


def test_blank_document_fails_with_friendly_error(client, fake_ocr):
    fake_ocr("   \n  ")
    document = upload_document(client, make_png())
    process_document(client, document["id"])
    detail = client.get(f"/api/documents/{document['id']}").json()
    assert detail["status"] == "failed"
    assert detail["error_message"]
    assert "Traceback" not in detail["error_message"]


def test_demo_data_endpoint(client):
    response = client.post("/api/documents/demo")
    assert response.status_code == 201
    body = response.json()
    assert body["total"] >= 5
    names = {item["filename"] for item in body["items"]}
    assert "demo_invoice_01.pdf" in names
    assert all(item["is_demo"] for item in body["items"])

    # demo documents flow through the real pipeline (background) and appear in search
    listing = client.get("/api/documents").json()
    assert listing["total"] >= 5
