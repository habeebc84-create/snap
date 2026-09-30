#!/usr/bin/env python3
"""SecureDoc AI setup: create data directories and initialize the SQLite schema."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

REQUIRED_DIRS = [
    "data/documents",
    "data/processed",
    "data/exports",
    "models/classifier",
    "models/extraction",
]


def main() -> int:
    for relative in REQUIRED_DIRS:
        (ROOT / relative).mkdir(parents=True, exist_ok=True)
        keep = ROOT / relative / ".gitkeep"
        if not keep.exists():
            keep.write_text("")

    from app.database.session import init_db

    init_db()
    print(f"SecureDoc AI ready at {ROOT}")
    print("  data/securedoc.db   — local database")
    print("  data/documents/     — uploaded files (generated names)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
