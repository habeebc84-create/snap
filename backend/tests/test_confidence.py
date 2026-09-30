"""Confidence scoring: weights, normalization, bands."""

from __future__ import annotations

from app.services.confidence import (
    CONFIDENCE_BANDS,
    DEFAULT_WEIGHTS,
    confidence_band,
    overall_confidence,
    score_field,
    validation_component,
)


def test_default_weights_are_the_documented_ones():
    assert DEFAULT_WEIGHTS == {"ocr": 0.30, "model": 0.30, "pattern": 0.20, "validation": 0.20}
    assert abs(sum(DEFAULT_WEIGHTS.values()) - 1.0) < 1e-9


def test_weighted_formula():
    score = score_field({"ocr": 0.9, "model": 0.9, "pattern": 0.9, "validation": 0.9})
    assert abs(score - 0.9) < 1e-6


def test_mixed_components():
    # 0.3*0.6 + 0.3*0.9 + 0.2*0.5 + 0.2*1.0 = 0.18+0.27+0.10+0.20 = 0.75
    score = score_field({"ocr": 0.6, "model": 0.9, "pattern": 0.5, "validation": 1.0})
    assert abs(score - 0.75) < 1e-6


def test_missing_components_renormalize():
    score = score_field({"ocr": 1.0, "model": None, "pattern": 1.0, "validation": None})
    assert abs(score - 1.0) < 1e-6  # renormalized over ocr+pattern only


def test_empty_components_score_zero():
    assert score_field({}) == 0.0
    assert score_field({"unknown": 1.0}) == 0.0


def test_values_clamped_to_range():
    assert score_field({"ocr": 5.0, "model": -1.0, "pattern": 1.0, "validation": 1.0}) <= 1.0


def test_validation_component_scores():
    assert validation_component([], "total") == 0.70  # neutral when not covered
    passed = [{"rule": "r", "passed": True, "fields": ["total"], "severity": "error"}]
    assert validation_component(passed, "total") == 1.0
    failed = [{"rule": "r", "passed": False, "fields": ["total"], "severity": "error"}]
    assert validation_component(failed, "total") == 0.30
    warning = [{"rule": "r", "passed": False, "fields": ["total"], "severity": "warning"}]
    assert validation_component(warning, "total") == 0.55


def test_overall_confidence_blend():
    assert overall_confidence([0.9, 0.9], 0.9) == 0.9
    only_class = overall_confidence([], 0.5)
    assert 0.0 <= only_class <= 1.0


def test_confidence_bands():
    assert confidence_band(0.95) == "high"
    assert confidence_band(0.80) == "medium"
    assert confidence_band(0.50) == "review"
    assert CONFIDENCE_BANDS == {"high": 0.90, "medium": 0.75}
