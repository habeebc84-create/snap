"""Settings endpoints (local persistence)."""

from __future__ import annotations

from fastapi import APIRouter

from app.database.session import SessionLocal
from app.schemas import SettingsIn
from app.services.audit import log_action
from app.services.settings_service import get_settings, update_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

_PRIVACY_KEYS = {"cloud_processing", "telemetry", "anonymous_analytics"}


@router.get("")
def read_settings() -> dict:
    db = SessionLocal()
    try:
        return get_settings(db)
    finally:
        db.close()


@router.put("")
def write_settings(payload: SettingsIn) -> dict:
    db = SessionLocal()
    try:
        data = payload.model_dump(exclude_none=True)
        result = update_settings(db, data)
        if result["changed"]:
            log_action(
                db, "settings_changed", entity_type="settings",
                detail=",".join(sorted(result["changed"])),
            )
            if _PRIVACY_KEYS.intersection(result["changed"]):
                log_action(
                    db, "privacy_toggled", entity_type="settings",
                    detail=",".join(sorted(_PRIVACY_KEYS.intersection(result["changed"]))),
                )
        return result["settings"]
    finally:
        db.close()
