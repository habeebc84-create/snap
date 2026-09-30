"""Layer-3 validation: arithmetic, dates, GSTIN structure, required fields."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from app.services.extraction.patterns import GSTIN_RE, parse_number

_GSTIN_SHAPE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$")
_COMMON_GST_RATES = (5.0, 12.0, 18.0, 28.0)


@dataclass
class RuleResult:
    rule: str
    passed: bool
    message: str
    fields: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)
    severity: str = "error"  # error | warning

    def to_dict(self) -> dict:
        return {
            "rule": self.rule,
            "passed": self.passed,
            "message": self.message,
            "severity": self.severity,
            "fields": self.fields,
            "details": self.details,
        }


def _num(fields: dict, name: str) -> float | None:
    entry = fields.get(name)
    if not entry:
        return None
    value = entry.value if hasattr(entry, "value") else str(entry)
    return parse_number(str(value))


def _has(fields: dict, name: str) -> bool:
    entry = fields.get(name)
    if not entry:
        return False
    value = entry.value if hasattr(entry, "value") else str(entry)
    return bool(str(value).strip())


def validate_document(document_type: str, fields: dict) -> list[RuleResult]:
    results: list[RuleResult] = []

    # ---------------------------------------------------------- required fields
    if document_type == "invoice":
        required = ["invoice_number", "invoice_date", "vendor_name", "total"]
    elif document_type == "receipt":
        required = ["merchant", "date", "total"]
    else:
        required = ["date"] if _has(fields, "date") else []

    if required:
        missing = [name for name in required if not _has(fields, name)]
        results.append(
            RuleResult(
                rule="required_fields",
                passed=not missing,
                message=(
                    "All required fields present"
                    if not missing
                    else f"Missing required fields: {', '.join(missing)}"
                ),
                fields=missing,
            )
        )

    # ------------------------------------------------------------- total math
    subtotal = _num(fields, "subtotal")
    tax = _num(fields, "tax")
    discount = _num(fields, "discount") or 0.0
    total = _num(fields, "total")

    if total is not None and subtotal is not None:
        expected = subtotal + (tax or 0.0) - discount
        tolerance = max(1.0, abs(total) * 0.01)
        passed = abs(expected - total) <= tolerance
        results.append(
            RuleResult(
                rule="total_consistency",
                passed=passed,
                message=(
                    f"✓ Invoice total validated (Subtotal {subtotal:,.2f} + Tax {tax or 0.0:,.2f}"
                    f"{' − Discount ' + format(discount, ',.2f') if discount else ''}"
                    f" = {expected:,.2f})"
                    if passed
                    else f"⚠ Total mismatch — expected {expected:,.2f}, extracted {total:,.2f}"
                ),
                fields=[name for name in ("subtotal", "tax", "discount", "total") if _has(fields, name)],
                details={"expected": round(expected, 2), "extracted": round(total, 2)},
            )
        )

    # ------------------------------------------------------- tax decomposition
    parts = [(_num(fields, name) or 0.0) for name in ("cgst", "sgst", "igst")]
    if any(parts) and tax is not None:
        parts_sum = sum(parts)
        tolerance = max(1.0, abs(tax) * 0.02)
        passed = abs(parts_sum - tax) <= tolerance
        results.append(
            RuleResult(
                rule="tax_breakdown",
                passed=passed,
                message=(
                    "Tax breakdown adds up to total tax"
                    if passed
                    else f"⚠ Tax breakdown {parts_sum:,.2f} ≠ total tax {tax:,.2f}"
                ),
                fields=[n for n in ("cgst", "sgst", "igst", "tax") if _has(fields, n)],
                details={"components": round(parts_sum, 2), "tax": round(tax, 2)},
            )
        )

    # -------------------------------------------------------- plausible GST rate
    if subtotal and tax and subtotal > 0:
        rate = (tax / subtotal) * 100.0
        plausible = any(abs(rate - common) <= 1.0 for common in _COMMON_GST_RATES)
        results.append(
            RuleResult(
                rule="tax_rate_plausible",
                passed=plausible,
                message=(
                    f"Implied tax rate {rate:.1f}% is a standard rate"
                    if plausible
                    else f"⚠ Implied tax rate {rate:.1f}% is not a standard rate (5/12/18/28%)"
                ),
                fields=["tax", "subtotal"],
                details={"rate": round(rate, 2)},
                severity="warning",
            )
        )

    # ------------------------------------------------------------------ dates
    for name in ("invoice_date", "due_date", "date"):
        entry = fields.get(name)
        if not entry:
            continue
        value = entry.value if hasattr(entry, "value") else str(entry)
        valid = bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)))
        results.append(
            RuleResult(
                rule=f"{name}_format",
                passed=valid,
                message="Date format is valid" if valid else f"⚠ {name} is not a valid date",
                fields=[name],
                severity="error",
            )
        )

    inv_date = _as_iso(fields, "invoice_date")
    due_date = _as_iso(fields, "due_date")
    if inv_date and due_date:
        passed = due_date >= inv_date
        results.append(
            RuleResult(
                rule="due_after_invoice",
                passed=passed,
                message=(
                    "Due date follows invoice date"
                    if passed
                    else "⚠ Due date is earlier than invoice date"
                ),
                fields=["invoice_date", "due_date"],
            )
        )

    # ------------------------------------------------------------------ GSTIN
    if _has(fields, "gstin"):
        value = str(fields["gstin"].value)
        passed = bool(_GSTIN_SHAPE.match(value.upper()))
        results.append(
            RuleResult(
                rule="gstin_format",
                passed=passed,
                message=(
                    "GSTIN structure is valid"
                    if passed
                    else f"⚠ GSTIN '{value}' does not match the expected structure"
                ),
                fields=["gstin"],
            )
        )

    return results


def validate_line_items(line_items: list, total: float | None) -> RuleResult | None:
    if not line_items:
        return None
    computed = sum(item.total if hasattr(item, "total") else item.get("total", 0.0) for item in line_items)
    if total is None:
        return RuleResult(
            rule="line_item_sum",
            passed=False,
            message=f"⚠ Line items sum to {computed:,.2f} but no total was extracted",
            fields=["total"],
            severity="warning",
        )
    tolerance = max(2.0, abs(total) * 0.02)
    passed = abs(computed - total) <= tolerance
    return RuleResult(
        rule="line_item_sum",
        passed=passed,
        message=(
            f"Line items sum to {computed:,.2f} (matches total {total:,.2f})"
            if passed
            else f"⚠ Line items sum to {computed:,.2f} but total is {total:,.2f}"
        ),
        fields=["total"],
        details={"items_sum": round(computed, 2), "total": round(total, 2)},
        severity="warning",
    )


def _as_iso(fields: dict, name: str):
    entry = fields.get(name)
    if not entry:
        return None
    value = entry.value if hasattr(entry, "value") else str(entry)
    return str(value) if re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)) else None
