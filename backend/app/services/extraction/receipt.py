"""Layer-2 receipt extraction (merchant, items, totals, payment method)."""

from __future__ import annotations

import re

from app.services.extraction.common import (
    ExtractionResult,
    FieldValue,
    extract_line_items,
    find_named_money,
    first_non_empty_line,
)
from app.services.extraction.patterns import (
    TIME_RE,
    detect_currency,
    find_dates,
    find_label_value,
    iter_lines,
    parse_date,
    parse_number,
)

_RECEIPT_NO_LABELS = ["receipt no", "receipt #", "receipt number", "bill no", "bill #",
                      "slip no", "invoice no", "receipt no."]
_DATE_LABELS = ["date", "receipt date", "bill date", "transaction date"]
_TIME_LABELS = ["time", "transaction time", "clock"]
_SUBTOTAL_LABELS = ["subtotal", "sub total", "net amount", "taxable amount"]
_TAX_LABELS = ["tax", "vat", "gst", "tax amount"]
_DISCOUNT_LABELS = ["discount", "less discount", "savings"]
_TOTAL_LABELS = ["total amount", "grand total", "amount due", "net total", "total"]

_PAYMENT_PATTERNS: list[tuple[str, str]] = [
    (r"\bupi\b", "UPI"),
    (r"\bgpay\b", "Google Pay"),
    (r"\bphonepe\b", "PhonePe"),
    (r"\bvisa\b", "Visa"),
    (r"\bmaster ?card\b", "Mastercard"),
    (r"\brupay\b", "RuPay"),
    (r"\bamex\b|american express", "Amex"),
    (r"\bcredit card\b", "Credit Card"),
    (r"\bdebit card\b", "Debit Card"),
    (r"\bpaytm\b", "Paytm"),
    (r"\bcash\b|cash tendered|money received", "Cash"),
]


class ReceiptExtractor:
    document_type = "receipt"

    def extract(self, text: str, document_type: str = "receipt") -> ExtractionResult:
        lines = iter_lines(text)
        fields: dict[str, FieldValue] = {}

        def put(name: str, value, conf: float, source: str = "pattern") -> None:
            if value is None or value == "":
                return
            if isinstance(value, float):
                value = f"{value:.2f}"
            fields[name] = FieldValue(name=name, value=str(value), confidence=max(0.0, min(conf, 0.99)), source=source)

        # merchant: first meaningful line
        merchant, idx = first_non_empty_line(
            lines,
            skip_patterns=(r"^\W*$", r"receipt|invoice|tax invoice", r"www\.|https?://"),
        )
        if merchant:
            put("merchant", merchant.title() if merchant.isupper() else merchant, 0.7, "heuristic")

        # receipt number
        value, conf, _ = find_label_value(lines, _RECEIPT_NO_LABELS)
        if value:
            put("receipt_number", value, conf)

        # date & time
        value, conf, _ = find_label_value(lines, _DATE_LABELS)
        iso = parse_date(value) if value else None
        if iso:
            put("date", iso, conf)
        else:
            dates = find_dates(text)
            if dates:
                put("date", dates[0], 0.6, "heuristic")

        value, conf, _ = find_label_value(lines, _TIME_LABELS)
        if value:
            match = TIME_RE.search(value)
            if match:
                put("time", match.group(1), conf)
        else:
            match = TIME_RE.search(text or "")
            if match:
                put("time", match.group(1), 0.6, "heuristic")

        # totals
        if (text or "").strip():
            currency, currency_conf = detect_currency(text)
            put("currency", currency, currency_conf)
        for name, labels in (
            ("subtotal", _SUBTOTAL_LABELS),
            ("tax", _TAX_LABELS),
            ("discount", _DISCOUNT_LABELS),
            ("total", _TOTAL_LABELS),
        ):
            value, conf = find_named_money(lines, labels)
            if value:
                put(name, value, conf)

        if "total" not in fields:
            from app.services.extraction.patterns import find_money

            money = find_money(text)
            if money:
                biggest = max(money, key=lambda m: m[0])
                put("total", f"{biggest[0]:.2f}", 0.5, "heuristic")

        # payment method
        low = text or ""
        for pattern, label in _PAYMENT_PATTERNS:
            if re.search(pattern, low, re.I):
                put("payment_method", label, 0.85, "heuristic")
                break

        items = extract_line_items(lines)
        return ExtractionResult("receipt", fields, items)


class GenericExtractor:
    """Fallback extractor for purchase orders / contracts / forms / other.

    Pulls whatever universally-valid fields exist (dates, totals, numbers)
    without pretending to know document-specific semantics.
    """

    document_type = "other"

    def extract(self, text: str, document_type: str = "other") -> ExtractionResult:
        lines = iter_lines(text)
        fields: dict[str, FieldValue] = {}

        value, conf, _ = find_label_value(lines, ["date", "dated", "issue date"])
        iso = parse_date(value) if value else None
        dates = find_dates(text)
        if iso:
            fields["date"] = FieldValue("date", iso, conf, "pattern")
        elif dates:
            fields["date"] = FieldValue("date", dates[0], 0.6, "heuristic")

        value, conf, _ = find_label_value(lines, ["purchase order no", "po no", "reference no", "ref no", "form no"])
        if value:
            fields["reference_number"] = FieldValue("reference_number", value, conf, "pattern")

        value, conf = find_named_money(lines, ["total", "grand total", "amount"])
        if value:
            fields["total"] = FieldValue("total", value, conf, "pattern")

        currency, currency_conf = detect_currency(text)
        fields["currency"] = FieldValue("currency", currency, currency_conf, "pattern")

        return ExtractionResult(document_type, fields, extract_line_items(lines))
