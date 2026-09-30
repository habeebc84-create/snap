"""SecureDoc AI configuration.

All values come from the environment (.env is optional and non-secret).
No API keys are required for the offline MVP.
"""

from __future__ import annotations

import os
from pathlib import Path

try:  # optional; the app still works without a .env file
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except Exception:  # pragma: no cover
    pass

ROOT_DIR = Path(__file__).resolve().parents[2]


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _path(value: str, default: str) -> Path:
    raw = value or default
    p = Path(raw)
    if not p.is_absolute():
        p = ROOT_DIR / p
    return p


class Settings:
    def __init__(self) -> None:
        self.app_env: str = os.getenv("APP_ENV", "development")
        self.root_dir: Path = ROOT_DIR

        default_db = ROOT_DIR / "data" / "securedoc.db"
        db_url = os.getenv("DATABASE_URL", f"sqlite:///{default_db}")
        if db_url.startswith("sqlite:///./"):
            db_url = f"sqlite:///{(ROOT_DIR / db_url[len('sqlite:///./'):]).resolve()}"
        self.database_url: str = db_url

        self.document_storage_path: Path = _path(
            os.getenv("DOCUMENT_STORAGE_PATH", ""), "./data/documents"
        )
        self.processed_path: Path = _path(os.getenv("PROCESSED_PATH", ""), "./data/processed")
        self.exports_path: Path = _path(os.getenv("EXPORTS_PATH", ""), "./data/exports")
        self.model_path: Path = _path(os.getenv("MODEL_PATH", ""), "./models")

        self.ocr_lang: str = os.getenv("OCR_LANG", "eng")
        self.confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.75"))
        self.max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "25"))
        self.cloud_processing: bool = _bool(os.getenv("CLOUD_PROCESSING"), False)
        self.telemetry: bool = _bool(os.getenv("TELEMETRY"), False)
        self.api_port: int = int(os.getenv("API_PORT", "8000"))

        # Confidence component weights (configurable, must sum to 1.0)
        self.confidence_weights: dict[str, float] = {
            "ocr": 0.30,
            "model": 0.30,
            "pattern": 0.20,
            "validation": 0.20,
        }

        for path in (
            self.document_storage_path,
            self.processed_path,
            self.exports_path,
            self.model_path,
            ROOT_DIR / "data",
        ):
            path.mkdir(parents=True, exist_ok=True)


settings = Settings()

APP_NAME = "SecureDoc AI"
