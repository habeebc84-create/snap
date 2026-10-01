"""Vercel serverless entrypoint for the SecureDoc AI FastAPI backend.

Vercel's Python runtime loads this file and serves the top-level ``app`` as a
single Vercel Function. ``vercel.json`` rewrites every ``/api/*`` request here
while preserving the original path, so the existing FastAPI routers (which are
already mounted under ``/api``) work unchanged.
"""

from __future__ import annotations

import os
import sys

# The FastAPI package lives in backend/app and is imported as `app`, so make
# `backend/` importable before loading it.
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app  # noqa: E402,F401
