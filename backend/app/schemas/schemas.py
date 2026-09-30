"""Pydantic schemas — every API input is validated here."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class DocumentSummary(BaseModel):
    id: str
    filename: str
    document_type: str
    status: str
    file_type: str
    file_size: int
    page_count: int
    overall_confidence: float
    processing_time_ms: int
    is_demo: bool
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


class ClassificationOut(BaseModel):
    document_type: str
    confidence: float
    model: str


class FieldOut(BaseModel):
    name: str
    value: str
    confidence: float
    source: str
    is_corrected: bool
    original_value: Optional[str] = None
    band: str = "review"


class LineItemOut(BaseModel):
    position: int
    description: str
    quantity: float
    unit_price: float
    tax: float
    total: float


class ValidationOut(BaseModel):
    rule: str
    passed: bool
    message: str
    severity: str = "error"
    fields: list[str] = Field(default_factory=list)
    details: dict = Field(default_factory=dict)


class PageOut(BaseModel):
    page_number: int
    width: int
    height: int


class DocumentDetail(DocumentSummary):
    classification: Optional[ClassificationOut] = None
    fields: list[FieldOut] = Field(default_factory=list)
    line_items: list[LineItemOut] = Field(default_factory=list)
    validations: list[ValidationOut] = Field(default_factory=list)
    pages: list[PageOut] = Field(default_factory=list)
    ocr_text: str = ""
    ocr_confidence: float = 0.0
    review_actions: list[dict] = Field(default_factory=list)


class StatusOut(BaseModel):
    id: str
    status: str
    document_type: str
    overall_confidence: float
    page_count: int
    error_message: Optional[str] = None
    updated_at: str


class ReviewFieldIn(BaseModel):
    field_name: str = Field(min_length=1, max_length=64)
    value: str = Field(max_length=4000)


class ReviewIn(BaseModel):
    fields: list[ReviewFieldIn] = Field(min_length=1, max_length=100)
    note: str = Field(default="", max_length=255)


class SettingsIn(BaseModel):
    ocr_language: Optional[str] = Field(default=None, max_length=32)
    confidence_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    max_file_size_mb: Optional[int] = Field(default=None, ge=1, le=200)
    parallel_processing: Optional[bool] = None
    cloud_processing: Optional[bool] = None
    telemetry: Optional[bool] = None
    anonymous_analytics: Optional[bool] = None
    auto_delete_temp: Optional[bool] = None
    retention_days: Optional[int] = Field(default=None, ge=0, le=3650)
    export_format: Optional[Literal["json", "csv", "xlsx", "pdf"]] = None
    export_include_confidence: Optional[bool] = None
    export_include_validation: Optional[bool] = None
    theme: Optional[Literal["light", "dark", "system"]] = None
    confidence_high: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    confidence_medium: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    consent: bool = False


class SearchResult(BaseModel):
    total: int
    items: list[DocumentSummary]


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: str
    detail: str
    created_at: str


class AnalyticsOut(BaseModel):
    kpis: dict
    by_type: list[dict]
    over_time: list[dict]
    totals: dict
    confidence: dict
    review: dict
    validation: dict
    performance: dict


class ModelOut(BaseModel):
    id: str
    name: str
    provider: str
    runtime: str
    version: Optional[str] = None
    installed: bool
    status: str
    fallback: Optional[str] = None


class ErrorOut(BaseModel):
    error: dict
