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

# Serverless platforms (e.g. Vercel) mount the project directory read-only and
# only expose /tmp as writable, so local data has to live there instead.
IS_SERVERLESS = bool(os.getenv("VERCEL"))


def _writable_default(name: str) -> Path:
    """Default location for writable data (SQLite file, uploads, exports)."""
    base = Path("/tmp/securedoc") if IS_SERVERLESS else ROOT_DIR / "data"
    return base / name if name else base


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

        default_db = _writable_default("securedoc.db")
        db_url = os.getenv("DATABASE_URL", f"sqlite:///{default_db}")
        if db_url.startswith("sqlite:///./"):
            db_url = f"sqlite:///{(ROOT_DIR / db_url[len('sqlite:///./'):]).resolve()}"
        self.database_url: str = db_url

        self.document_storage_path: Path = _path(
            os.getenv("DOCUMENT_STORAGE_PATH", ""), str(_writable_default("documents"))
        )
        self.processed_path: Path = _path(
            os.getenv("PROCESSED_PATH", ""), str(_writable_default("processed"))
        )
        self.exports_path: Path = _path(
            os.getenv("EXPORTS_PATH", ""), str(_writable_default("exports"))
        )
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
            _writable_default(""),
        ):
            try:
                path.mkdir(parents=True, exist_ok=True)
            except OSError:
                # Read-only filesystem (serverless) — start anyway and let the
                # API surface a friendly error if the path is actually used.
                pass


settings = Settings()

APP_NAME = "SecureDoc AI"
