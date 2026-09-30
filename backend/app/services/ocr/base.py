"""OCR abstraction.

The pipeline depends only on `OCRProvider`, so additional engines
(Tesseract, PaddleOCR, EasyOCR, a Snapdragon-optimized engine, ...) plug in
without touching any other code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class OCRBox:
    text: str
    confidence: float
    x: int
    y: int
    w: int
    h: int
    page: int = 1


@dataclass
class OCRResult:
    text: str
    language: str
    confidence: float
    pages: int
    boxes: list[OCRBox] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "language": self.language,
            "confidence": round(self.confidence, 4),
            "pages": self.pages,
            "boxes": len(self.boxes),
        }


class OCRProvider(ABC):
    """Interface every OCR engine must implement."""

    name: str = "ocr"
    language: str = "eng"

    @abstractmethod
    def extract_text(self, image_path: str) -> OCRResult:
        """Run OCR on a single preprocessed image and return an OCRResult."""

    def available(self) -> bool:  # pragma: no cover - trivial
        return True


class TesseractProvider(OCRProvider):
    name = "tesseract"

    def __init__(self, language: str = "eng", psm: int = 4):
        # psm 4 (single column, variable size) reads the header line AND keeps
        # label/value pairs on one line — verified against the demo corpus.
        self.language = language
        self.psm = psm
        self._binary_ok: bool | None = None

    # availability -----------------------------------------------------
    def available(self) -> bool:
        if self._binary_ok is None:
            try:
                import pytesseract

                pytesseract.get_tesseract_version()
                self._binary_ok = True
            except Exception:
                self._binary_ok = False
        return self._binary_ok

    # OCR --------------------------------------------------------------
    def extract_text(self, image_path: str) -> OCRResult:
        if not self.available():
            from app.utils.errors import OCRError

            raise OCRError(
                "The local OCR engine is not installed on this machine."
            )

        import pytesseract
        from PIL import Image
        from pytesseract import Output

        image = Image.open(image_path)
        config = f"--psm {self.psm}"
        try:
            data = pytesseract.image_to_data(
                image, lang=self.language, config=config, output_type=Output.DICT
            )
        except Exception as exc:
            from app.utils.errors import OCRError

            raise OCRError() from exc

        lines: dict[tuple, list[str]] = {}
        boxes: list[OCRBox] = []
        confidences: list[float] = []

        for i, word in enumerate(data["text"]):
            word = (word or "").strip()
            if not word:
                continue
            try:
                conf = float(data["conf"][i])
            except (ValueError, TypeError):
                conf = -1.0
            if conf < 0:
                continue
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            lines.setdefault(key, []).append(word)
            confidences.append(conf / 100.0)
            boxes.append(
                OCRBox(
                    text=word,
                    confidence=conf / 100.0,
                    x=int(data["left"][i]),
                    y=int(data["top"][i]),
                    w=int(data["width"][i]),
                    h=int(data["height"][i]),
                )
            )

        ordered = [lines[key] for key in sorted(lines)]
        text = "\n".join(" ".join(tokens) for tokens in ordered)
        mean_conf = sum(confidences) / len(confidences) if confidences else 0.0

        return OCRResult(
            text=text,
            language=self.language,
            confidence=mean_conf,
            pages=1,
            boxes=boxes,
        )


class StaticOCRProvider(OCRProvider):
    """Deterministic OCR stub used in tests and as an explicit degraded mode."""

    name = "static"

    def __init__(self, text: str = "", confidence: float = 0.9, language: str = "eng"):
        self._text = text
        self._confidence = confidence
        self.language = language

    def extract_text(self, image_path: str) -> OCRResult:
        return OCRResult(
            text=self._text,
            language=self.language,
            confidence=self._confidence,
            pages=1,
            boxes=[],
        )


def get_ocr_provider(language: str = "eng") -> OCRProvider:
    """Factory: Tesseract is the primary engine; swap here when adding engines."""
    provider = TesseractProvider(language=language)
    if provider.available():
        return provider
    # Engine missing entirely → surfaced as a friendly error at process time.
    return provider
