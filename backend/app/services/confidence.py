"""Confidence scoring.

Final field confidence =
    0.30 × OCR + 0.30 × Model + 0.20 × Pattern + 0.20 × Validation
(weights configurable via settings; normalized over the components present).
"""

from __future__ import annotations

from app.config import settings

DEFAULT_WEIGHTS: dict[str, float] = dict(settings.confidence_weights)

CONFIDENCE_BANDS = {"high": 0.90, "medium": 0.75}  # 90-100 High, 75-89 Medium, <75 Review


def score_field(components: dict[str, float | None], weights: dict[str, float] | None = None) -> float:
    """Weighted average over available components (weights renormalized)."""
    weights = weights or DEFAULT_WEIGHTS
    considered = {
        key: max(0.0, min(1.0, value))
        for key, value in components.items()
        if key in weights and value is not None
    }
    if not considered:
        return 0.0
    total_weight = sum(weights[key] for key in considered)
    if total_weight <= 0:
        return 0.0
    score = sum(weights[key] * value for key, value in considered.items()) / total_weight
    return round(min(1.0, score), 4)


def validation_component(validation_results: list[dict], field_name: str) -> float:
    """Score how well validation supports a specific field."""
    implicated = [r for r in validation_results if field_name in (r.get("fields") or [])]
    if not implicated:
        return 0.70  # neutral: field not covered by any rule
    failed_errors = [r for r in implicated if not r.get("passed") and r.get("severity", "error") == "error"]
    failed_warnings = [r for r in implicated if not r.get("passed")]
    if failed_errors:
        return 0.30
    if failed_warnings:
        return 0.55
    return 1.0


def overall_confidence(field_scores: list[float], classification_confidence: float) -> float:
    """Blend of field-level scores and classification confidence."""
    if field_scores:
        fields_mean = sum(field_scores) / len(field_scores)
        return round(0.75 * fields_mean + 0.25 * classification_confidence, 4)
    return round(0.6 * classification_confidence, 4)


def confidence_band(score: float, medium: float | None = None, high: float | None = None) -> str:
    high_t = high if high is not None else CONFIDENCE_BANDS["high"]
    medium_t = medium if medium is not None else CONFIDENCE_BANDS["medium"]
    if score >= high_t:
        return "high"
    if score >= medium_t:
        return "medium"
    return "review"
