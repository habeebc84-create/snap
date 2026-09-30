#!/bin/sh
# SecureDoc AI — idempotent dependency installer (frontend + backend).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Frontend dependencies"
if [ -f frontend/package-lock.json ] && command -v npm >/dev/null 2>&1; then
  npm install --prefix frontend
elif command -v bun >/dev/null 2>&1; then
  bun install --cwd frontend
else
  npm install --prefix frontend
fi

# Backend steps are skipped when Python is unavailable (e.g. Node-only CI /
# hosting images that only need the frontend build) or when deps already exist.
PYBIN="$(command -v python3 || command -v python || true)"
if [ -n "$PYBIN" ]; then
  echo "==> Backend dependencies (virtualenv)"
  if [ ! -x "$ROOT/.venv/bin/python" ]; then
    "$PYBIN" -m venv "$ROOT/.venv"
  fi
  if ! "$ROOT/.venv/bin/python" -c "import fastapi" >/dev/null 2>&1; then
    "$ROOT/.venv/bin/pip" install -q --upgrade pip
    "$ROOT/.venv/bin/pip" install -q -r backend/requirements.txt
  fi

  echo "==> Directories"
  "$ROOT/.venv/bin/python" scripts/setup.py
else
  echo "==> Python not found — skipping backend install (frontend-only environment)"
fi

echo "Install complete. Run: sh ./scripts/dev.sh"
