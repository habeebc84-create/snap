#!/bin/sh
# SecureDoc AI — preview launcher.
# Starts the local FastAPI service, then the Vite dev server in the foreground.
# Freebuff injects PORT; the backend listens on API_PORT (default 8000).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PY="$ROOT/.venv/bin/python"
if [ ! -x "$PY" ]; then PY="$(command -v python3 || command -v python)"; fi

API_PORT="${API_PORT:-8000}"
PORT="${PORT:-5173}"

mkdir -p data/documents data/processed data/exports

"$PY" -m uvicorn app.main:app --app-dir "$ROOT/backend" --host 0.0.0.0 --port "$API_PORT" --log-level warning &
BACK_PID=$!
cleanup() { kill "$BACK_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Wait for the API to answer /api/health before starting the frontend.
i=0
while [ "$i" -lt 60 ]; do
  if "$PY" -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:$API_PORT/api/health', timeout=1).status==200 else 1)" 2>/dev/null; then
    echo "==> API ready on :$API_PORT"
    break
  fi
  i=$((i + 1))
  sleep 0.5
done

VITE="$ROOT/frontend/node_modules/.bin/vite"
if [ ! -x "$VITE" ]; then VITE="vite"; fi
echo "==> Frontend on 0.0.0.0:$PORT (API proxy -> :$API_PORT)"
# Run Vite from frontend/ so it picks up vite.config.ts + index.html.
cd "$ROOT/frontend"
"$VITE" --host 0.0.0.0 --port "$PORT" --strictPort
