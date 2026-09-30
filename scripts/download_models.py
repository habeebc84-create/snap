#!/usr/bin/env python3
"""Model manager CLI.

The offline MVP ships with deterministic local models (keyword classifier +
regex extraction) so nothing ever has to be downloaded. This script reports
registry status and installs *your own* ONNX classifier if you have one.

Usage:
    .venv/bin/python scripts/download_models.py            # status
    .venv/bin/python scripts/download_models.py --install model.onnx vocab.json

Expected layout (models/registry):
    models/classifier/model.onnx    — logits over [invoice, receipt, purchase_order,
                                      contract, form, other]
    models/classifier/vocab.json    — {"token": index, ...} bag-of-words vocabulary
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

STATUS_ONLY = ["status", "--status", "-s"]


def status() -> int:
    from app.config import settings
    from app.services.registry import model_status

    print()
    print("SECUREDOC AI — MODEL REGISTRY")
    print("=" * 64)
    for entry in model_status():
        mark = "✓" if entry["installed"] else "✗"
        print(f"{mark} {entry['name']:<22} {entry['provider']}/{entry['runtime']:<12} {entry['status']}")
        if entry["version"]:
            print(f"    version: {entry['version']}")
        if entry["fallback"]:
            print(f"    fallback: {entry['fallback']}")
    print("-" * 64)
    print(f"Model path: {settings.model_path}")
    print("No model download is required for the offline MVP.")
    return 0


def install(model_path: str, vocab_path: str) -> int:
    from app.config import settings

    model_src = Path(model_path)
    vocab_src = Path(vocab_path)
    if not model_src.exists() or not vocab_src.exists():
        print("ERROR: both an .onnx model and its vocab.json must exist.")
        return 1

    json.loads(vocab_src.read_text())  # validate vocabulary shape
    target = settings.model_path / "classifier"
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model_src, target / "model.onnx")
    shutil.copy2(vocab_src, target / "vocab.json")
    print(f"Installed classifier into {target}")
    print("Restart the backend to load it. The registry will report 'Installed'.")
    return 0


def main() -> int:
    if len(sys.argv) >= 4 and sys.argv[1] == "--install":
        return install(sys.argv[2], sys.argv[3])
    if any(arg in STATUS_ONLY for arg in sys.argv[1:]) or len(sys.argv) == 1:
        return status()
    print(__doc__)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
