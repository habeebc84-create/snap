"""Model manager endpoints — honest installed/unavailable reporting."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import ModelOut
from app.services.registry import MODEL_REGISTRY, model_status

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models", response_model=list[ModelOut])
def list_models() -> list[dict]:
    return model_status()


@router.get("/models/registry")
def registry() -> dict:
    return {"registry": MODEL_REGISTRY, "models": model_status()}
