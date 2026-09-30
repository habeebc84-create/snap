"""Document classification: heuristic fallback + abstraction behavior."""

from __future__ import annotations

from app.services.classification.base import (
    DOCUMENT_CLASSES,
    ClassificationResult,
    DocumentClassifier,
    HeuristicClassifier,
    OnnxClassifier,
    get_classifier,
)

INVOICE = (
    "Tax Invoice\nInvoice No: INV-1\nBill To: Acme\nGSTIN: 29ABCDE1234F1Z5\n"
    "HSN 9983\nSubtotal 100.00\nTax 18.00\nGrand Total 118.00\nPayment Terms: Net 30\n"
    "Due Date: 01/10/2026\nAmount Payable INR 118.00\n"
)
RECEIPT = (
    "Corner Store\nReceipt No: 1001\nCash tendered 200.00\nChange due 20.00\n"
    "Bill No 1001\nPayment method: card ending 4242\nThank you for your purchase\n"
)
PURCHASE_ORDER = (
    "Purchase Order\nPO No: PO-778\nShip To: Warehouse 3\n"
    "Expected Delivery: 01/10/2026\nTerms of Purchase: net 45\n"
)
CONTRACT = (
    "This Agreement is entered into by both parties.\nTerms and Conditions apply.\n"
    "Governing Law: India.\nWitnesses hereto.\nSignature: ______\n" * 3
)
FORM = "Application Form\nForm No: F-22\nI hereby declare the details are correct.\n"


def test_classes_constant():
    assert DOCUMENT_CLASSES == (
        "invoice", "receipt", "purchase_order", "contract", "form", "other",
    )


def test_classify_invoice():
    result = HeuristicClassifier().classify(INVOICE)
    assert result.document_type == "invoice"
    assert result.confidence >= 0.75
    assert 0.0 <= result.confidence <= 1.0
    assert result.model == "heuristic"


def test_classify_receipt():
    result = HeuristicClassifier().classify(RECEIPT)
    assert result.document_type == "receipt"
    assert result.confidence >= 0.6


def test_classify_purchase_order():
    result = HeuristicClassifier().classify(PURCHASE_ORDER)
    assert result.document_type == "purchase_order"


def test_classify_contract():
    result = HeuristicClassifier().classify(CONTRACT)
    assert result.document_type == "contract"


def test_classify_form():
    result = HeuristicClassifier().classify(FORM)
    assert result.document_type == "form"


def test_classify_garbage_is_other_with_low_confidence():
    result = HeuristicClassifier().classify("asdf qwer zxcv 12345")
    assert result.document_type in DOCUMENT_CLASSES
    assert result.confidence < 0.75  # would trigger needs_review


def test_onnx_slot_reports_unavailable_without_model(tmp_path):
    classifier = OnnxClassifier(model_dir=tmp_path)
    assert classifier.available() is False


def test_factory_falls_back_to_heuristic():
    classifier = get_classifier()
    assert isinstance(classifier, DocumentClassifier)
    assert classifier.available()


def test_result_serialization():
    result = HeuristicClassifier().classify(INVOICE)
    payload = result.to_dict()
    assert payload["document_type"] == "invoice"
    assert "confidence" in payload
    assert isinstance(payload, dict)
