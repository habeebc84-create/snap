"""Layer-1 deterministic pattern extraction: dates, money, GSTIN, IDs, contact info.

Everything here is regex/structural — no model required.
"""

from __future__ import annotations

import re
from datetime import datetime

# --------------------------------------------------------------------- patterns
GSTIN_RE = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b")
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?\b\d{10,12}\b")
URL_RE = re.compile(r"\b(?:https?://|www\.)\S+\b", re.I)

NUM = r"-?\d[\d,]*(?:\.\d{1,2})?"
MONEY_RE = re.compile(rf"(?:₹|rs\.?|inr|usd|\$|€|eur|£|gbp)\s*({NUM})", re.I)
BARE_NUM_RE = re.compile(rf"\b({NUM})\b")

_MONTHS = (
    "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
)
DATE_PATTERNS: list[re.Pattern] = [
    re.compile(rf"\b(\d{{4}}-\d{{1,2}}-\d{{1,2}})\b"),
    re.compile(rf"\b(\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}})\b"),
    re.compile(rf"\b(\d{{1,2}}\s+(?:{_MONTHS})[a-z]*\.?\s+\d{{2,4}})\b", re.I),
    re.compile(rf"\b((?:{_MONTHS})[a-z]*\.?\s+\d{{1,2}},?\s+\d{{2,4}})\b", re.I),
]
TIME_RE = re.compile(r"\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\b", re.I)

INVOICE_NO_RE = re.compile(r"\b(?:inv|invno|inv-|invoice)[\s#:-]*([a-z0-9][a-z0-9\-/]{2,})\b", re.I)
PO_RE = re.compile(r"\b(?:po|purchase\s*order)[\s#:-]*(?:no\.?|number|#)?\s*:?\s*([a-z0-9\-/]{3,})\b", re.I)


def parse_number(raw: str | None) -> float | None:
    if raw is None:
        return None
    cleaned = raw.replace(",", "").replace("₹", "").strip()
    cleaned = re.sub(r"(?i)^(rs\.?|inr|usd|\$|€|£)\s*", "", cleaned).strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def format_money(value: float, currency: str = "INR") -> str:
    symbol = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(currency, "")
    body = f"{value:,.2f}"
    return f"{symbol}{body}" if symbol else f"{currency} {body}"


def parse_date(raw: str) -> str | None:
    """Normalize a date string to ISO YYYY-MM-DD, or None."""
    raw = (raw or "").strip().rstrip(",.-")
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
                "%m/%d/%Y", "%m-%d-%Y", "%d %b %Y", "%d %B %Y", "%d %b, %Y",
                "%d %B %Y", "%b %d %Y", "%B %d %Y", "%b %d, %Y", "%B %d, %Y"):
        try:
            parsed = datetime.strptime(raw, fmt)
            if 1990 <= parsed.year <= 2100:
                return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def find_dates(text: str) -> list[str]:
    """All ISO-normalized dates found in text, in document order."""
    found: list[tuple[int, str]] = []
    for pattern in DATE_PATTERNS:
        for match in pattern.finditer(text or ""):
            iso = parse_date(match.group(1))
            if iso:
                found.append((match.start(), iso))
    found.sort(key=lambda item: item[0])
    seen: set[str] = set()
    ordered: list[str] = []
    for _, iso in found:
        if iso not in seen:
            seen.add(iso)
            ordered.append(iso)
    return ordered


def find_money(text: str) -> list[tuple[float, str]]:
    """All monetary amounts as (value, matched_text) in document order."""
    out: list[tuple[float, str]] = []
    for match in MONEY_RE.finditer(text or ""):
        value = parse_number(match.group(1))
        if value is not None:
            out.append((value, match.group(0)))
    return out


def detect_currency(text: str) -> tuple[str, float]:
    low = (text or "").lower()
    if "₹" in text or re.search(r"\brs\.?\b", low) or "inr" in low:
        return "INR", 0.92
    if "gstin" in low or "cgst" in low or "sgst" in low or "hsn" in low:
        return "INR", 0.85
    if re.search(r"\bupi\b", low):
        return "INR", 0.80
    if "$" in text or "usd" in low:
        return "USD", 0.9
    if "€" in text or "eur" in low:
        return "EUR", 0.9
    if "£" in text or "gbp" in low:
        return "GBP", 0.9
    return "USD", 0.55


# ---------------------------------------------------------------- label → value
def iter_lines(text: str) -> list[str]:
    return [re.sub(r"[ \t]+", " ", line).strip() for line in (text or "").splitlines()]


def _label_index(line: str, labels: list[str]) -> tuple[int, str] | None:
    """Return (position, matched_label) of the earliest label occurrence.

    Labels are matched with word boundaries so `total` never matches inside
    `subtotal`, `to` never matches inside `total`, etc.
    """
    low = line.lower()
    best: tuple[int, str] | None = None
    for label in labels:
        pattern = rf"(?<![a-z]){re.escape(label.lower())}(?![a-z])"
        match = re.search(pattern, low)
        if match and (best is None or match.start() < best[0]):
            best = (match.start(), label)
    return best


def find_label_value(
    lines: list[str],
    labels: list[str],
    *,
    money: bool = False,
    allow_next_line: bool = True,
) -> tuple[str | None, float, int]:
    """Find `label value` associations in text lines.

    Pass A scans for a value on the same line as the label (confidence 0.92).
    Only if nothing is found does Pass B look at the following line (0.82).
    This ordering prevents header rows from stealing values from body rows.

    Returns (value, confidence, line_index).
    """
    # ---- Pass A: same-line value ----------------------------------------
    for i, line in enumerate(lines):
        if not line:
            continue
        hit = _label_index(line, labels)
        if hit is None:
            continue
        idx, label = hit
        remainder = line[idx + len(label):].lstrip(" \t:#.-–— ")
        if not remainder:
            continue
        if money:
            hits = list(MONEY_RE.finditer(remainder)) or list(BARE_NUM_RE.finditer(remainder))
            if hits:
                return hits[-1].group(0), 0.92, i
            continue
        value = _clean_value(remainder, labels)
        if value:
            return value, 0.92, i

    if not allow_next_line:
        return None, 0.0, -1

    # ---- Pass B: value on the next non-empty line ------------------------
    for i, line in enumerate(lines):
        if not line:
            continue
        hit = _label_index(line, labels)
        if hit is None:
            continue
        idx, label = hit
        remainder = line[idx + len(label):]
        if remainder.strip(" \t:#.-–— "):
            continue  # already had (but rejected) a same-line value
        for j in range(i + 1, min(i + 3, len(lines))):
            nxt = lines[j]
            if not nxt:
                continue
            if _label_index(nxt, labels):
                break
            if money:
                hits = list(MONEY_RE.finditer(nxt)) or list(BARE_NUM_RE.finditer(nxt))
                if hits:
                    return hits[-1].group(0), 0.82, j
            else:
                value = _clean_value(nxt, labels)
                if value:
                    return value, 0.82, j
            break
    return None, 0.0, -1


def _clean_value(raw: str, labels: list[str]) -> str:
    value = raw.strip(" \t:-#.")
    low = value.lower()
    for label in labels:
        if low == label.lower():
            return ""
    value = re.sub(r"\s{2,}", " ", value)
    if not value or len(value) > 200:
        return ""
    if URL_RE.fullmatch(value):
        return ""
    return value
