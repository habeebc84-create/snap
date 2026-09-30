"""Friendly, user-safe errors. Raw stack traces are never returned to clients."""

from __future__ import annotations


class AppError(Exception):
    """Base for errors that are safe to surface with a friendly message."""

    def __init__(self, message: str, *, code: str = "bad_request", status: int = 400, hint: str = ""):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.hint = hint

    def payload(self) -> dict:
        body = {"code": self.code, "message": self.message}
        if self.hint:
            body["hint"] = self.hint
        return {"error": body}


class FileValidationError(AppError):
    def __init__(self, message: str, *, code: str = "invalid_file", hint: str = ""):
        super().__init__(message, code=code, status=400, hint=hint)


class FileTooLargeError(AppError):
    def __init__(self, max_mb: int):
        super().__init__(
            f"This file is larger than the {max_mb} MB limit.",
            code="file_too_large",
            status=413,
            hint="Try a smaller file or raise the limit in Settings → Processing.",
        )


class PreprocessError(AppError):
    def __init__(self, message: str = "We couldn't read this document."):
        super().__init__(
            message,
            code="preprocess_failed",
            status=422,
            hint="The file may be corrupted or contain an unsupported format.",
        )


class OCRError(AppError):
    def __init__(self, message: str = "Text recognition failed."):
        super().__init__(
            message,
            code="ocr_failed",
            status=422,
            hint="The document may be blank, blurry, or unsupported.",
        )


class ModelUnavailableError(AppError):
    def __init__(self, model: str):
        super().__init__(
            "An AI model is unavailable.",
            code="model_unavailable",
            status=503,
            hint=f"Using deterministic local fallback for: {model}.",
        )


class NotFoundError(AppError):
    def __init__(self, resource: str = "Document"):
        super().__init__(
            f"{resource} not found.",
            code="not_found",
            status=404,
            hint="It may have been deleted.",
        )


class ExportError(AppError):
    def __init__(self, fmt: str):
        super().__init__(
            f"We couldn't generate the {fmt.upper()} export.",
            code="export_failed",
            status=500,
            hint="Try again or choose another format.",
        )
