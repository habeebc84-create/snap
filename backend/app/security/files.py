"""File handling security.

Rules:
- Uploaded filenames are NEVER used as storage paths (generated UUID only).
- Type is verified by magic bytes, not by the client-provided extension.
- Export/attachment filenames are strictly sanitized.
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.config import settings
from app.utils.errors import FileTooLargeError, FileValidationError

ALLOWED_TYPES = {"pdf", "png", "jpg", "jpeg", "webp"}
MAX_DIMENSION = 40  # px; used by magic sniffing helpers if needed

_MAGIC = {
    "pdf": (b"%PDF",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "webp": (b"RIFF",),  # verified further below
}


def sniff_type(header: bytes) -> str | None:
    """Return detected type from magic bytes, or None if unsupported."""
    if header.startswith(b"%PDF"):
        return "pdf"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "webp"
    return None


def safe_original_name(raw: str | None) -> str:
    """Strip any path components / control chars from a client filename (metadata only)."""
    name = (raw or "document").replace("\\", "/").split("/")[-1]
    name = "".join(ch for ch in name if ch.isprintable() and ch not in "\r\n\t")
    name = re.sub(r"[^\w .()\-]", "_", name).strip(" .")
    name = re.sub(r"\s+", " ", name)
    if not name or name in {".", ".."}:
        name = "document"
    return name[:200]


def safe_extension(detected: str) -> str:
    ext = detected.lower()
    if ext == "jpeg":
        ext = "jpg"
    return ext if ext in ALLOWED_TYPES else "bin"


def sanitized_export_name(document_id: str, doc_type: str, ext: str) -> str:
    """Attachment filename: generated, never user-controlled."""
    kind = re.sub(r"[^a-z0-9_]", "", (doc_type or "document").lower()) or "document"
    ext = re.sub(r"[^a-z0-9]", "", ext.lower()) or "bin"
    return f"securedoc_{kind}_{document_id[:8]}.{ext}"


def validate_upload(*, filename: str | None, content: bytes, declared_type: str | None = None) -> tuple[str, str]:
    """Validate size + magic bytes. Returns (safe original name, detected type)."""
    if not content:
        raise FileValidationError(
            "This file is empty.",
            hint="Choose a PDF or image that contains data.",
        )

    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_upload_mb:
        raise FileTooLargeError(settings.max_upload_mb)

    detected = sniff_type(content[:16])
    if detected is None:
        raise FileValidationError(
            "We couldn't read this document.",
            hint="The file may be corrupted or contain an unsupported format. Supported: PDF, PNG, JPG, JPEG, WebP.",
        )

    name = safe_original_name(filename)
    ext_from_name = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    # Extension/magic mismatch is a red flag (e.g. .exe renamed to .pdf never passes magic check).
    if ext_from_name and ext_from_name not in ALLOWED_TYPES and ext_from_name != detected:
        # Magic bytes still decide; keep name but record detected type.
        pass

    return name, detected


def store_document(content: bytes, detected_type: str) -> tuple[str, Path]:
    """Persist bytes under a generated UUID path. Returns (document_id, stored_path)."""
    document_id = uuid.uuid4().hex
    ext = safe_extension(detected_type)
    path = settings.document_storage_path / f"{document_id}.{ext}"
    path.write_bytes(content)
    return document_id, path


def delete_stored(file_path: str) -> bool:
    try:
        p = Path(file_path)
        # Only allow deletion inside the document storage directory.
        p.resolve().relative_to(settings.document_storage_path.resolve())
        if p.exists():
            p.unlink()
            return True
    except (ValueError, OSError):
        return False
    return False
