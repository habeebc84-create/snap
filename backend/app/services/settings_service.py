"""Persistent application settings (stored in the local settings table)."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.config import settings as app_settings
from app.models import Setting
from app.utils.errors import AppError

DEFAULTS: dict = {
    "ocr_language": "eng",
    "confidence_threshold": 0.75,
    "max_file_size_mb": 25,
    "parallel_processing": False,
    # Privacy — off by default; enabling cloud processing requires explicit consent.
    "cloud_processing": False,
    "telemetry": False,
    "anonymous_analytics": False,
    "auto_delete_temp": True,
    "retention_days": 30,
    # Export
    "export_format": "csv",
    "export_include_confidence": True,
    "export_include_validation": True,
    # Appearance
    "theme": "system",
    # Confidence presentation thresholds (90-100 High, 75-89 Medium, <75 Review)
    "confidence_high": 0.90,
    "confidence_medium": 0.75,
}

BOOL_KEYS = {
    "parallel_processing",
    "cloud_processing",
    "telemetry",
    "anonymous_analytics",
    "auto_delete_temp",
    "export_include_confidence",
    "export_include_validation",
}
FLOAT_KEYS = {"confidence_threshold", "confidence_high", "confidence_medium"}
INT_KEYS = {"max_file_size_mb", "retention_days"}


def get_settings(db: Session) -> dict:
    values = dict(DEFAULTS)
    for row in db.query(Setting).all():
        if row.key in values:
            try:
                values[row.key] = json.loads(row.value)
            except (TypeError, ValueError):
                values[row.key] = row.value
    return values


def apply_to_runtime(values: dict) -> None:
    """Push settings that the pipeline/security layer reads at runtime."""
    app_settings.ocr_lang = str(values.get("ocr_language", "eng"))
    app_settings.confidence_threshold = float(values.get("confidence_threshold", 0.75))
    app_settings.max_upload_mb = int(values.get("max_file_size_mb", 25))
    app_settings.cloud_processing = bool(values.get("cloud_processing", False))
    app_settings.telemetry = bool(values.get("telemetry", False))


def update_settings(db: Session, payload: dict) -> dict:
    """Persist settings. Enabling cloud processing demands explicit consent."""
    data = {k: v for k, v in payload.items() if k != "consent" and v is not None}

    if data.get("cloud_processing") is True and not payload.get("consent"):
        raise AppError(
            "Cloud processing requires your explicit consent.",
            code="consent_required",
            status=403,
            hint="Confirm consent to enable external processing. It stays disabled by default.",
        )

    current = get_settings(db)
    changed: list[str] = []
    for key, value in data.items():
        if key not in DEFAULTS:
            continue
        if key in BOOL_KEYS:
            value = bool(value)
        elif key in FLOAT_KEYS:
            value = max(0.0, min(1.0, float(value)))
        elif key in INT_KEYS:
            value = int(value)
        if current.get(key) != value:
            current[key] = value
            changed.append(key)
        row = db.get(Setting, key)
        if row is None:
            db.add(Setting(key=key, value=json.dumps(value)))
        else:
            row.value = json.dumps(value)
    db.commit()

    if changed:
        apply_to_runtime(current)
    return {"settings": current, "changed": changed}
