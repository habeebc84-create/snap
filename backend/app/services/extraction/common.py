"""Shared extraction primitives: line items + generic fallback extraction."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.extraction.patterns import (
    BARE_NUM_RE,
    MONEY_RE,
    find_label_value,
    iter_lines,
    parse_number,
)


@dataclass
class FieldValue:
    name: str
    value: str
    confidence: float
    source: str = "pattern"          # pattern | heuristic | model | derived
    components: dict[str, float] = field(default_factory=dict)


@dataclass
class LineItemData:
    description: str
    quantity: float
    unit_price: float
    tax: float
    total: float

    def to_dict(self) -> dict:
        return {
            "description": self.description,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "tax": self.tax,
            "total": self.total,
        }


@dataclass
class ExtractionResult:
    document_type: str
    fields: dict[str, FieldValue]
    line_items: list[LineItemData]

    def compact(self) -> dict:
        return {
            "document_type": self.document_type,
            "fields": {k: {"value": v.value, "confidence": v.confidence, "source": v.source}
                       for k, v in self.fields.items()},
            "line_items": [item.to_dict() for item in self.line_items],
        }


_DOC_META = re.compile(
    r"invoice|receipt|purchase order|agreement|form no|tax invoice|gstin|pan |www\.|https?://|@",
    re.I,
)
HEADER_TOKENS = ("description", "item", "qty", "quantity", "rate", "price", "amount", "total", "hsn", "tax")


def _is_header_row(tokens: list[str]) -> bool:
    joined = " ".join(tokens).lower()
    return ("description" in joined or "item" in joined) and (
        "qty" in joined or "quantity" in joined
    )


def _col_map(header: str) -> dict[str, int]:
    """Map logical columns from a header row."""
    tokens = re.split(r"\s{2,}|\s*\|\s*", header.strip())
    mapping: dict[str, int] = {}
    for i, token in enumerate(tokens):
        low = token.lower()
        if any(k in low for k in ("desc", "item", "product", "service")):
            mapping.setdefault("description", i)
        elif "qty" in low or "quant" in low:
            mapping.setdefault("quantity", i)
        elif "rate" in low or "price" in low or "unit" in low:
            mapping.setdefault("unit_price", i)
        elif "%" in low or "tax" in low or "gst" in low:
            mapping.setdefault("tax", i)
        elif "amount" in low or "total" in low or "value" in low:
            mapping.setdefault("total", i)
    return mapping


def extract_line_items(lines: list[str]) -> list[LineItemData]:
    """Parse table rows of the form:  Description  Qty  Rate  Tax%  Amount.

    Works on 2+ space separated columns (the common OCR layout) and falls back
    to trailing-number heuristics for single-spaced rows.
    """
    items: list[LineItemData] = []
    columns: dict[str, int] = {}

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line:
            continue
        if _is_header_row(re.split(r"\s{2,}|\s*\|\s*", line.strip())):
            columns = _col_map(line)
            continue

        tokens = re.split(r"\s{2,}|\s*\|\s*", line.strip())
        if len(tokens) >= 3:
            desc = tokens[0].strip()
            if not desc or _DOC_META.search(desc):
                continue
            if any(label in desc.lower() for label in
                   ("subtotal", "sub total", "grand total", "total tax", "cgst", "sgst", "igst",
                    "discount", "payment", "amount payable", "taxable")):
                continue
            numeric: list[float] = []
            for token in tokens[1:]:
                value = parse_number(token.replace("%", ""))
                if value is None:
                    numeric = []
                    break
                numeric.append(value)
            if len(numeric) >= 2:
                item = _build_item(desc, numeric, columns)
                if item:
                    items.append(item)
                    continue

        # Fallback: description followed by numbers on a single-spaced line.
        # Stricter than the column parser: require a clean description and
        # arithmetic that actually holds, so dates/phones aren't misread as items.
        if len(items) < 60:
            first_num = BARE_NUM_RE.search(line)
            if not first_num:
                continue
            numbers = [parse_number(m.group(0)) for m in BARE_NUM_RE.finditer(line)]
            numbers = [n for n in numbers if n is not None]
            desc = line[: first_num.start()].strip(" \t-–:.")
            if not _fallback_desc_ok(desc) or len(numbers) not in (3, 4):
                continue
            quantity, unit_price, total = numbers[0], numbers[1], numbers[-1]
            if quantity <= 0 or unit_price <= 0:
                continue
            expected = quantity * unit_price
            tax_rate = numbers[2] if len(numbers) == 4 else 0.0
            taxed = 0 < tax_rate < 100
            expected_taxed = expected * (1 + tax_rate / 100) if taxed else expected
            tolerance = max(1.0, total * 0.08)
            if abs(total - expected) > tolerance and abs(total - expected_taxed) > tolerance:
                continue
            tax_amount = expected * tax_rate / 100 if taxed else 0.0
            items.append(LineItemData(desc, quantity, unit_price, round(tax_amount, 2), round(total, 2)))
    return items[:80]


_FALLBACK_DESC_RE = re.compile(
    r":|\b(subtotal|sub total|grand total|total|tax|gst|discount|date|time|phone|email|"
    r"payment|invoice|receipt|bill|gstin|terms|signature|form no)\b",
    re.I,
)


def _fallback_desc_ok(desc: str) -> bool:
    if not desc or len(desc) < 3 or len(desc) > 80:
        return False
    if not any(ch.isalpha() for ch in desc):
        return False
    if _FALLBACK_DESC_RE.search(desc):
        return False
    return True


def _build_item(description: str, numbers: list[float], columns: dict[str, int]) -> LineItemData | None:
    if len(numbers) >= 4:
        quantity, unit_price, tax_rate, total = numbers[0], numbers[1], numbers[2], numbers[3]
        if unit_price and abs(total - quantity * unit_price * (1 + tax_rate / 100)) <= max(2.0, total * 0.06):
            tax_amount = quantity * unit_price * tax_rate / 100
        elif unit_price and abs(total - quantity * unit_price) <= max(2.0, total * 0.06):
            tax_rate = 0.0
            tax_amount = 0.0
            total = quantity * unit_price
        else:
            tax_amount = quantity * unit_price * tax_rate / 100
        return LineItemData(description, quantity, unit_price, round(tax_amount, 2), round(total, 2))
    if len(numbers) == 3:
        quantity, unit_price, total = numbers
        if unit_price and abs(total - quantity * unit_price) <= max(2.0, total * 0.08):
            total = quantity * unit_price
        return LineItemData(description, quantity, unit_price, 0.0, round(total, 2))
    return None


def first_non_empty_line(lines: list[str], skip_patterns: tuple = ()) -> tuple[str | None, int]:
    for i, line in enumerate(lines):
        text = line.strip()
        if not text or len(text) < 2:
            continue
        if any(re.search(p, text, re.I) for p in skip_patterns):
            continue
        return text, i
    return None, -1


def find_named_money(lines: list[str], labels: list[str]) -> tuple[str | None, float]:
    value, conf, _ = find_label_value(lines, labels, money=True)
    if value:
        number = parse_number(value) or 0.0
        return f"{number:.2f}", conf
    return None, 0.0


def money_after_index(lines: list[str], start: int = 0) -> list[tuple[float, int]]:
    hits: list[tuple[float, int]] = []
    for i, line in enumerate(lines[start:], start=start):
        for match in MONEY_RE.finditer(line):
            value = parse_number(match.group(1))
            if value is not None:
                hits.append((value, i))
    return hits
