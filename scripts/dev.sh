#!/bin/sh
# SecureDoc AI — local development launcher (backend + frontend together).
# Equivalent to running the two commands below in separate terminals:
#   .venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
#   npm --prefix frontend run dev
exec sh "$(dirname "$0")/preview.sh"
