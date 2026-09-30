"""Field extraction: invoices, receipts, missing values, line items."""

from __future__ import annotations

from app.services.extraction.base import get_extractor
from app.services.extraction.common import extract_line_items
from app.services.extraction.invoice import InvoiceExtractor
from app.services.extraction.patterns import detect_currency, find_dates, parse_date
from app.services.extraction.receipt import ReceiptExtractor

INVOICE = """ACME TRADERS
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

INVOICE_NO_NUMBER = """ACME TRADERS
Tax Invoice
Invoice Date: 25 Sep 2026
Subtotal 100.00
Tax 18.00
Grand Total 118.00
"""

RECEIPT = """QUICKMART STORES
Receipt No: RCP-88213
Date: 26/09/2026
Time: 14:35
Fresh Milk 1L 2 62.00 124.00
Subtotal 169.00
Tax 6.00
Discount 5.00
Total 170.00
Payment Method: UPI
"""


def test_invoice_fields_extracted():
    result = InvoiceExtractor().extract(INVOICE, "invoice")
    fields = {k: v.value for k, v in result.fields.items()}
    assert fields["invoice_number"] == "INV-2026-1042"
    assert fields["invoice_date"] == "2026-09-25"
    assert fields["due_date"] == "2026-10-25"
    assert fields["vendor_name"]
    assert fields["customer_name"] == "Nimbus Retail Pvt Ltd"
    assert fields["gstin"] == "27AAACA1234A1Z5"
    assert fields["currency"] == "INR"
    assert fields["subtotal"] == "11000.00"
    assert fields["tax"] == "1980.00"
    assert fields["total"] == "12980.00"
    assert fields["payment_terms"] == "Net 30"


def test_invoice_field_confidences_present_and_bounded():
    result = InvoiceExtractor().extract(INVOICE, "invoice")
    assert result.fields, "expected extracted fields"
    for field in result.fields.values():
        assert 0.0 < field.confidence <= 0.99
        assert field.source in {"pattern", "heuristic", "derived", "model", "manual"}


def test_missing_invoice_number_is_absent_not_fake():
    result = InvoiceExtractor().extract(INVOICE_NO_NUMBER, "invoice")
    assert "invoice_number" not in result.fields
    assert "total" in result.fields


def test_wrong_total_value_extracts_as_written():
    """Extraction reports what's printed; validation decides if it's wrong."""
    text = INVOICE.replace("Grand Total 12,980.00", "Grand Total 12,440.00")
    result = InvoiceExtractor().extract(text, "invoice")
    assert result.fields["total"].value == "12440.00"


def test_line_items_parsed_with_tax():
    result = InvoiceExtractor().extract(INVOICE, "invoice")
    assert len(result.line_items) == 1
    item = result.line_items[0].to_dict()
    assert item["description"] == "Cement Bags"
    assert item["quantity"] == 20
    assert item["unit_price"] == 420
    assert item["total"] == 9912
    assert item["tax"] == 1512


def test_receipt_fields_extracted():
    result = ReceiptExtractor().extract(RECEIPT, "receipt")
    fields = {k: v.value for k, v in result.fields.items()}
    assert fields["merchant"] == "Quickmart Stores (Demo)" or "QUICKMART" in fields["merchant"].upper()
    assert fields["receipt_number"] == "RCP-88213"
    assert fields["date"] == "2026-09-26"
    assert fields["time"] == "14:35"
    assert fields["total"] == "170.00"
    assert fields["payment_method"] == "UPI"
    assert len(result.line_items) == 1


def test_line_item_parser_rejects_dates_and_phones():
    lines = ["Date: 25/09/2026", "Phone: 9876543210", "Time: 14:35"]
    assert extract_line_items(lines) == []


def test_blank_text_yields_no_fields():
    result = InvoiceExtractor().extract("", "invoice")
    assert result.fields == {}
    assert result.line_items == []


def test_extractor_dispatch():
    assert get_extractor("invoice").document_type == "invoice"
    assert get_extractor("receipt").document_type == "receipt"
    generic = get_extractor("contract")
    result = generic.extract("Date: 01/01/2026", "contract")
    assert "date" in result.fields


def test_date_parsing_formats():
    assert parse_date("25 Sep 2026") == "2026-09-25"
    assert parse_date("25/09/2026") == "2026-09-25"
    assert parse_date("2026-09-25") == "2026-09-25"
    assert parse_date("not a date") is None
    assert find_dates("dated 01/02/2026 and 2026-03-04") == ["2026-02-01", "2026-03-04"]


def test_currency_detection():
    assert detect_currency("Pay Rs. 100 GSTIN 29ABCDE1234F1Z5")[0] == "INR"
    assert detect_currency("Total $12.00")[0] == "USD"
    assert detect_currency("Total €12.00")[0] == "EUR"
