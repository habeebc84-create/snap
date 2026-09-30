"""SecureDoc AI — FastAPI application.

Offline document intelligence. Nothing is sent to external services.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import analytics, documents, exports, models_api, search, security, settings
from app.config import APP_NAME, settings as app_settings
from app.database.session import init_db
from app.utils.errors import AppError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("securedoc")

app = FastAPI(
    title=APP_NAME,
    description=(
        "Privacy-first, offline document intelligence. "
        "Upload → preprocess → OCR → classify → extract → validate — all on this device. "
        "No API keys, no cloud calls."
    ),
    version="1.0.0",
)

# Dev-friendly CORS; the frontend normally reaches the API through the Vite proxy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content=exc.payload())


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "invalid_request",
                "message": "Some of the provided values aren't valid.",
                "hint": "Check the highlighted inputs and try again.",
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    # Log server-side only; the client receives a friendly message (never a stack trace).
    logger.exception("unhandled error: %s", type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Something went wrong on our side.",
                "hint": "Please try again. Your document was not sent anywhere.",
            }
        },
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info(
        "SecureDoc AI started (env=%s, storage=%s)",
        app_settings.app_env, app_settings.document_storage_path,
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": APP_NAME, "offline": True}


app.include_router(documents.router)
app.include_router(search.router)
app.include_router(analytics.router)
app.include_router(exports.router)
app.include_router(settings.router)
app.include_router(security.router)
app.include_router(models_api.router)
