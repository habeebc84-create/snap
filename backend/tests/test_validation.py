"""Validation rules: arithmetic, GSTIN, dates, required fields."""

from __future__ import annotations

from app.services.extraction.common import FieldValue, LineItemData
from app.services.validation.validator import (
    RuleResult,
    validate_document,
    validate_line_items,
)


def _fields(**values) -> dict:
    return {name: FieldValue(name, value, 0.9) for name, value in values.items()}


def _by_rule(results: list[RuleResult]) -> dict:
    return {rule.rule: rule for rule in results}


def test_invoice_total_validated():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="INV-1", invoice_date="2026-09-25",
        vendor_name="Acme", subtotal="10200.00", tax="1840.00", total="12040.00",
    )))
    assert results["total_consistency"].passed is True
    assert "validated" in results["total_consistency"].message
    assert results["required_fields"].passed is True


def test_total_mismatch_detected():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="INV-1", invoice_date="2026-09-25",
        vendor_name="Acme", subtotal="10200.00", tax="1840.00", total="12440.00",
    )))
    rule = results["total_consistency"]
    assert rule.passed is False
    assert "mismatch" in rule.message.lower()
    assert rule.details["expected"] == 12040.0
    assert rule.details["extracted"] == 12440.0


def test_discount_included_in_total_math():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="INV-1", invoice_date="2026-09-25", vendor_name="Acme",
        subtotal="1000.00", tax="180.00", discount="80.00", total="1100.00",
    )))
    assert results["total_consistency"].passed is True


def test_missing_required_fields_reported():
    results = _by_rule(validate_document("invoice", _fields(total="10.00")))
    rule = results["required_fields"]
    assert rule.passed is False
    assert "invoice_number" in rule.fields
    assert "invoice_date" in rule.fields
    assert "vendor_name" in rule.fields


def test_gstin_format_valid_and_invalid():
    valid = _by_rule(validate_document("invoice", _fields(
        invoice_number="X1", invoice_date="2026-01-01", vendor_name="A",
        total="1.00", gstin="27AAACA1234A1Z5")))
    assert valid["gstin_format"].passed is True

    invalid = _by_rule(validate_document("invoice", _fields(
        invoice_number="X1", invoice_date="2026-01-01", vendor_name="A",
        total="1.00", gstin="NOT-A-GSTIN")))
    assert invalid["gstin_format"].passed is False


def test_invalid_date_detected():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="X1", invoice_date="25th last Tuesday", vendor_name="A", total="1.00")))
    assert results["invoice_date_format"].passed is False


def test_due_date_before_invoice_date_fails():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="X1", invoice_date="2026-09-25", due_date="2026-08-01",
        vendor_name="A", total="1.00")))
    assert results["due_after_invoice"].passed is False


def test_tax_breakdown_consistency():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="X1", invoice_date="2026-09-25", vendor_name="A",
        subtotal="1000.00", cgst="90.00", sgst="90.00", tax="180.00", total="1180.00")))
    assert results["tax_breakdown"].passed is True


def test_plausible_tax_rate_warning():
    results = _by_rule(validate_document("invoice", _fields(
        invoice_number="X1", invoice_date="2026-09-25", vendor_name="A",
        subtotal="1000.00", tax="137.00", total="1137.00")))
    rule = results["tax_rate_plausible"]
    assert rule.passed is False
    assert rule.severity == "warning"  # warning alone shouldn't block completion


def test_line_item_sum_rule():
    items = [LineItemData("A", 1, 100, 0, 100), LineItemData("B", 2, 50, 0, 100)]
    assert validate_line_items(items, 200).passed is True
    assert validate_line_items(items, 500).passed is False
    assert validate_line_items([], 200) is None


def test_receipt_required_fields():
    results = _by_rule(validate_document("receipt", _fields(
        merchant="Store", date="2026-09-26", total="10.00")))
    assert results["required_fields"].passed is True
