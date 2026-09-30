"""Document preprocessing: PDF rendering + image cleanup before OCR.

Steps performed (all local, all in-memory / on-disk under data/processed):
  - PDF page rendering (PyMuPDF) at target DPI
  - EXIF orientation correction
  - Resolution normalization (upscale tiny pages, cap huge ones)
  - Grayscale conversion
  - Contrast enhancement (autocontrast)
  - Noise removal (median filter)
  - Deskew / rotation detection (projection-profile search)
  - Adaptive thresholding (integral image, numpy)
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

from app.config import settings
from app.utils.errors import PreprocessError

TARGET_DPI = 300
MAX_DIMENSION = 3200
MIN_DIMENSION = 600


@dataclass
class ProcessedPage:
    page_number: int
    image_path: str
    width: int
    height: int


class Preprocessor:
    """Turns an uploaded file into clean, OCR-ready page images."""

    def __init__(self, target_dpi: int = TARGET_DPI, max_dimension: int = MAX_DIMENSION):
        self.target_dpi = target_dpi
        self.max_dimension = max_dimension

    # ------------------------------------------------------------------ public
    def prepare(self, file_path: str, file_type: str, document_id: str) -> list[ProcessedPage]:
        out_dir = settings.processed_path / document_id
        out_dir.mkdir(parents=True, exist_ok=True)
        try:
            if file_type == "pdf":
                images = self._render_pdf(file_path)
            else:
                images = [self._open_image(file_path)]
        except PreprocessError:
            raise
        except Exception as exc:  # corrupt / unreadable
            raise PreprocessError() from exc

        if not images:
            raise PreprocessError("This document has no readable pages.")

        pages: list[ProcessedPage] = []
        for index, image in enumerate(images, start=1):
            try:
                clean = self._clean(image)
                out_path = out_dir / f"page_{index}.png"
                clean.save(out_path, format="PNG")
                pages.append(
                    ProcessedPage(
                        page_number=index,
                        image_path=str(out_path),
                        width=clean.width,
                        height=clean.height,
                    )
                )
            except Exception as exc:
                raise PreprocessError() from exc
        return pages

    def cleanup(self, document_id: str) -> None:
        target = settings.processed_path / document_id
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)

    # ----------------------------------------------------------------- stages
    def _render_pdf(self, file_path: str) -> list[Image.Image]:
        import fitz  # PyMuPDF

        try:
            doc = fitz.open(file_path)
        except Exception as exc:
            raise PreprocessError() from exc
        if doc.page_count == 0:
            doc.close()
            raise PreprocessError("This PDF has no pages.")
        if doc.page_count > 50:
            doc.close()
            raise PreprocessError("This PDF has too many pages (limit: 50).")

        zoom = self.target_dpi / 72.0
        images: list[Image.Image] = []
        try:
            for page in doc:
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
                images.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
        finally:
            doc.close()
        return images

    def _open_image(self, file_path: str) -> Image.Image:
        try:
            image = Image.open(file_path)
            image.load()
        except Exception as exc:
            raise PreprocessError() from exc
        return image.convert("RGB") if image.mode not in ("L", "RGB") else image

    def _clean(self, image: Image.Image) -> Image.Image:
        image = ImageOps.exif_transpose(image)
        image = self._resize(image)
        gray = ImageOps.grayscale(image)
        gray = ImageOps.autocontrast(gray, cutoff=1)
        gray = gray.filter(ImageFilter.MedianFilter(size=3))  # noise removal
        skew = self._estimate_skew(gray)
        if abs(skew) >= 0.5:
            gray = gray.rotate(-skew, resample=Image.BILINEAR, expand=False, fillcolor=255)
            gray = ImageOps.autocontrast(gray, cutoff=1)
        return gray

    def _resize(self, image: Image.Image) -> Image.Image:
        width, height = image.size
        longest = max(width, height)
        if longest > self.max_dimension:
            scale = self.max_dimension / longest
            image = image.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.LANCZOS)
        elif longest < MIN_DIMENSION:
            scale = min(4.0, MIN_DIMENSION / max(1, longest))
            image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)
        return image

    def _estimate_skew(self, gray: Image.Image) -> float:
        """Projection-profile skew detection over a small angle window (degrees)."""
        try:
            small = gray.copy()
            small.thumbnail((900, 900))
            base = np.asarray(small, dtype=np.uint8)
            binary = (base < 128).astype(np.float32)
            if binary.sum() < 50:  # near-blank page: nothing to deskew
                return 0.0
            best_angle, best_score = 0.0, -1.0
            for angle in np.arange(-5.0, 5.1, 1.0):
                rotated = small.rotate(float(angle), resample=Image.BILINEAR, fillcolor=255)
                arr = np.asarray(rotated, dtype=np.uint8)
                rows = (arr < 128).sum(axis=1).astype(np.float64)
                score = float(rows.var())
                if score > best_score:
                    best_score, best_angle = score, float(angle)
            return best_angle
        except Exception:
            return 0.0


def adaptive_threshold(gray: Image.Image, block: int = 31, c: int = 12) -> Image.Image:
    """Integral-image adaptive threshold (numpy). Optional pre-OCR binarization."""
    arr = np.asarray(gray, dtype=np.float32)
    block = max(3, block | 1)
    pad = block // 2
    padded = np.pad(arr, pad, mode="edge")
    integral = padded.cumsum(axis=0).cumsum(axis=1)
    h, w = arr.shape
    area = float(block * block)
    ys = np.arange(h)
    xs = np.arange(w)
    y0, y1 = ys, ys + block
    x0, x1 = xs, xs + block
    bottom_right = integral[y1[:, None], x1[None, :]]
    top_right = integral[y0[:, None], x1[None, :]]
    bottom_left = integral[y1[:, None], x0[None, :]]
    top_left = integral[y0[:, None], x0[None, :]]
    local_mean = (bottom_right - top_right - bottom_left + top_left) / area
    binary = ((arr > (local_mean - c)) * 255).astype(np.uint8)
    return Image.fromarray(binary, mode="L")
