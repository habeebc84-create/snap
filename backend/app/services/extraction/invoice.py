"""Layer-2 document-aware invoice extraction built on Layer-1 patterns."""

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
    GSTIN_RE,
    INVOICE_NO_RE,
    PO_RE,
    detect_currency,
    find_dates,
    find_label_value,
    iter_lines,
    parse_number,
)

# label priority lists (first match by position wins; ordered most-specific first)
_INVOICE_NO_LABELS = [
    "invoice no", "invoice number", "invoice #", "invoice no.", "inv no", "inv #",
    "invoice", "bill no", "bill number", "inv. no",
]
_VENDOR_LABELS = ["vendor", "seller", "supplier", "sold by", "from"]
_CUSTOMER_LABELS = ["bill to", "ship to", "bill to:", "customer", "buyer", "consignee", "to"]
_SUBTOTAL_LABELS = ["sub total", "subtotal", "taxable value", "net amount", "amount before tax", "gross amount"]
_DISCOUNT_LABELS = ["discount", "less discount", "less: discount", "rebate"]
_TAX_LABELS = ["total tax", "tax amount", "total tax amount", "tax", "vat", "gst amount", "gst"]
_CGST_LABELS = ["cgst", "cgst amount", "central tax"]
_SGST_LABELS = ["sgst", "sgst amount", "state tax", "utgst"]
_IGST_LABELS = ["igst", "igst amount", "integrated tax"]
_TOTAL_LABELS = [
    "grand total", "total payable", "amount payable", "total due", "net payable",
    "balance due", "total amount", "grand total amount", "total",
]
_DUE_DATE_LABELS = ["due date", "payment due", "pay by", "bill due", "due on"]
_PAY_TERMS_LABELS = ["payment terms", "terms of payment", "payment method", "terms"]
_PO_LABELS = ["purchase order no", "purchase order number", "po no", "po number", "po #", "p.o. no"]
_GSTIN_LABELS = ["gstin", "gst no", "gst number", "gstin/uin"]

_ADDRESS_STOP = re.compile(
    r"^(invoice|receipt|tax invoice|bill|total|subtotal|gstin|pan|phone|tel|email|date|amount|payment|terms)\b"
    r"|synthetic demo",
    re.I,
)

_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-/#.]{2,39}$")


def _looks_like_id(value: str) -> bool:
    """Rejects addresses/sentences accidentally captured as an ID."""
    return bool(_ID_RE.match(value.strip())) and any(ch.isdigit() for ch in value)


class InvoiceExtractor:
    document_type = "invoice"

    def extract(self, text: str, document_type: str = "invoice") -> ExtractionResult:
        lines = iter_lines(text)
        fields: dict[str, FieldValue] = {}

        def put(name: str, value, conf: float, source: str = "pattern") -> None:
            if value is None or value == "":
                return
            if isinstance(value, float):
                value = f"{value:.2f}"
            fields[name] = FieldValue(name=name, value=str(value), confidence=max(0.0, min(conf, 0.99)), source=source)

        # --- invoice number -------------------------------------------------
        value, conf, idx = find_label_value(lines, _INVOICE_NO_LABELS)
        if value and not _looks_like_id(value):
            value, conf, idx = None, 0.0, -1
        if not value:
            match = INVOICE_NO_RE.search(text or "")
            if match and _looks_like_id(match.group(1)):
                value, conf, idx = match.group(1), 0.72, -1
        put("invoice_number", value, conf if value else 0.0)

        # --- dates ------------------------------------------------------------
        dates = find_dates(text)
        value, conf, date_idx = find_label_value(
            lines, ["invoice date", "date", "dated", "issue date"]
        )
        iso = None
        if value:
            from app.services.extraction.patterns import parse_date

            iso = parse_date(value)
        if iso:
            put("invoice_date", iso, conf)
        elif dates:
            put("invoice_date", dates[0], 0.62, "heuristic")

        value, conf, _ = find_label_value(lines, _DUE_DATE_LABELS)
        iso_due = None
        if value:
            from app.services.extraction.patterns import parse_date

            iso_due = parse_date(value)
        if iso_due:
            put("due_date", iso_due, conf)
        elif dates and len(dates) > 1 and fields.get("invoice_date"):
            # Only infer a due date when a second explicit date exists.
            for candidate in dates[1:]:
                if candidate != fields["invoice_date"].value:
                    put("due_date", candidate, 0.5, "heuristic")
                    break

        # --- parties -----------------------------------------------------------
        vendor_name, vendor_conf, vendor_idx = self._party_name(lines, _VENDOR_LABELS)
        put("vendor_name", vendor_name, vendor_conf, "heuristic" if vendor_conf < 0.8 else "pattern")

        customer_name, customer_conf, customer_idx = self._party_name(lines, _CUSTOMER_LABELS)
        put("customer_name", customer_name, customer_conf, "heuristic" if customer_conf < 0.8 else "pattern")

        put("vendor_address", self._address(lines, vendor_idx), 0.6, "heuristic")
        put("customer_address", self._address(lines, customer_idx), 0.6, "heuristic")

        # --- identifiers --------------------------------------------------------
        gstin_hits: list[tuple[str, int]] = []
        for i, line in enumerate(lines):
            match = GSTIN_RE.search(line.upper())
            if match:
                gstin_hits.append((match.group(0), i))
        if gstin_hits:
            labelled = None
            for i, line in enumerate(lines):
                low = line.lower()
                if any(lbl in low for lbl in _GSTIN_LABELS) and GSTIN_RE.search(line.upper()):
                    labelled = GSTIN_RE.search(line.upper()).group(0)
                    break
            put("gstin", labelled or gstin_hits[0][0], 0.93 if labelled else 0.78)

        value, conf, _ = find_label_value(lines, _PO_LABELS)
        if value:
            put("purchase_order_number", value, conf)
        else:
            match = PO_RE.search(text or "")
            if match:
                put("purchase_order_number", match.group(1), 0.7)

        # --- money ---------------------------------------------------------------
        if (text or "").strip():
            currency, currency_conf = detect_currency(text)
            put("currency", currency, currency_conf)

        for name, labels in (
            ("subtotal", _SUBTOTAL_LABELS),
            ("discount", _DISCOUNT_LABELS),
            ("cgst", _CGST_LABELS),
            ("sgst", _SGST_LABELS),
            ("igst", _IGST_LABELS),
            ("total", _TOTAL_LABELS),
        ):
            value, conf = find_named_money(lines, labels)
            if value:
                put(name, value, conf)

        value, conf = find_named_money(lines, _TAX_LABELS)
        if value and parse_number(value):
            put("tax", value, conf)

        # Derive tax from components when not explicitly labelled.
        if "tax" not in fields:
            parts = [parse_number(fields[k].value) for k in ("cgst", "sgst", "igst") if k in fields]
            parts = [p for p in parts if p]
            if parts:
                put("tax", f"{sum(parts):.2f}", 0.8, "derived")

        # Last-resort total: largest money amount in the lower half of the document.
        if "total" not in fields:
            from app.services.extraction.patterns import find_money

            money = find_money(text)
            if money:
                low = len(text) // 2
                tail = [m for m in money if text.find(m[1]) >= low] or money
                biggest = max(tail, key=lambda m: m[0])
                put("total", f"{biggest[0]:.2f}", 0.5, "heuristic")

        # --- terms ------------------------------------------------------------------
        value, conf, _ = find_label_value(lines, _PAY_TERMS_LABELS)
        if value and len(value) <= 80:
            put("payment_terms", value, conf)
        else:
            match = re.search(r"\b(net\s+\d{1,3}|due on receipt|payable within \d+ days?)\b", text or "", re.I)
            if match:
                put("payment_terms", match.group(0).strip(), 0.7, "heuristic")

        line_items = extract_line_items(lines)
        return ExtractionResult("invoice", fields, line_items)

    # ---------------------------------------------------------------- helpers
    def _party_name(self, lines: list[str], labels: list[str]) -> tuple[str | None, float, int]:
        """Explicit `Label: Name` match first, then a positional heuristic.

        Labels use word boundaries so `to` can't match inside `total`.
        """
        blocker = {"address", "name", "details", "info", "billing to", "shipping to"}
        for i, line in enumerate(lines):
            low = line.lower().strip()
            for label in labels:
                pattern = rf"(?<![a-z]){re.escape(label.lower())}(?![a-z])\s*[:#.-]?\s*"
                match = re.search(pattern, low)
                if not match:
                    continue
                remainder = low[match.end():].strip(" \t:#.-")
                if remainder and remainder not in blocker and not remainder.isdigit():
                    if len(remainder.split()) <= 12:
                        name = remainder.title() if remainder.isupper() else remainder
                        return name, 0.9, i
                for j in range(i + 1, min(i + 3, len(lines))):
                    nxt = lines[j].strip()
                    if nxt and len(nxt) > 2 and nxt[0].isalpha():
                        name = nxt.title() if nxt.isupper() else nxt
                        return name, 0.88, j
                break
        # Heuristic: first meaningful line is usually the vendor/header
        first, idx = first_non_empty_line(
            lines,
            skip_patterns=(
                r"^\W*$", r"tax invoice", r"^invoice", r"^receipt", r"www\.|https?://",
                r"synthetic demo", r"gstin", r"pan\b", r"\d{2}[a-z]{5}\d{4}",
            ),
        )
        if first and len(first.split()) <= 10 and idx >= 0:
            name = first.title() if first.isupper() else first
            return name, 0.6, idx
        return None, 0.0, -1

    def _address(self, lines: list[str], start_idx: int) -> str | None:
        if start_idx < 0:
            return None
        collected: list[str] = []
        for j in range(start_idx + 1, min(start_idx + 4, len(lines))):
            line = lines[j].strip()
            if not line:
                break
            if re.search(r"synthetic demo", line, re.I):
                continue  # banner text — skip without ending the address
            if _ADDRESS_STOP.search(line) or GSTIN_RE.search(line.upper()):
                break
            if len(line) > 3 and any(ch.isalpha() for ch in line):
                collected.append(line)
            if len(" ".join(collected)) > 140:
                break
        if not collected:
            return None
        return ", ".join(collected)[:200]
