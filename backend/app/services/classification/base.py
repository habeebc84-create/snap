"""Document classification.

Layers:
  1. ONNX local model (if present in models/classifier/) — optional, preferred.
  2. Deterministic keyword/structure heuristic — always available fallback.

The app must keep working when a model file is missing.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

DOCUMENT_CLASSES = ("invoice", "receipt", "purchase_order", "contract", "form", "other")


@dataclass
class ClassificationResult:
    document_type: str
    confidence: float
    model: str = "heuristic"
    scores: dict[str, float] | None = None

    def to_dict(self) -> dict:
        return {
            "document_type": self.document_type,
            "confidence": round(self.confidence, 4),
            "model": self.model,
            "scores": self.scores or {},
        }


class DocumentClassifier(ABC):
    @abstractmethod
    def classify(self, text: str, image=None) -> ClassificationResult:
        """Return a document class + confidence in [0, 1]."""

    @abstractmethod
    def available(self) -> bool:
        ...


# --------------------------------------------------------------------- heuristic
_KEYWORDS: dict[str, list[tuple[str, float]]] = {
    "invoice": [
        (r"\btax\s*invoice\b", 3.0),
        (r"\binvoice\s*(no|number|#|num)\b", 3.0),
        (r"\binvoice\b", 2.0),
        (r"\bbill\s*to\b", 1.5),
        (r"\bhsn\s*/?\s*sac\b", 1.5),
        (r"\bgstin\b", 1.5),
        (r"\bpayment\s*terms\b", 1.0),
        (r"\bamount\s*payable\b", 1.0),
        (r"\bdue\s*date\b", 1.0),
    ],
    "receipt": [
        (r"\breceipt\b", 3.0),
        (r"\bthank you for your (purchase|business|visit)\b", 2.5),
        (r"\bchange\s*(due|returned)\b", 2.0),
        (r"\bcash\s*tendered\b", 2.0),
        (r"\bbill\s*no\b", 1.5),
        (r"\bpayment\s*method\b", 1.5),
        (r"\bcard\s*ending\b", 1.5),
        (r"\bupi\b", 1.0),
    ],
    "purchase_order": [
        (r"\bpurchase\s*order\b", 3.5),
        (r"\bpo\s*(no|number|#)\b", 3.0),
        (r"\bexpected\s*delivery\b", 1.5),
        (r"\bship\s*to\b", 1.0),
        (r"\bterms\s*of\s*purchase\b", 1.5),
    ],
    "contract": [
        (r"\bagreement\b", 3.0),
        (r"\bterms\s*and\s*conditions\b", 2.0),
        (r"\bwitness(es)?\b", 2.0),
        (r"\bhereby\s+(agreed|entered)\b", 2.0),
        (r"\bgoverning\s*law\b", 2.0),
        (r"\bsignature\b", 1.0),
        (r"\bthis\s+(agreement|contract)\b", 2.5),
    ],
    "form": [
        (r"\bform\s*(no|number|#)\b", 3.0),
        (r"\bapplication\s*form\b", 3.0),
        (r"\bdeclare\b", 1.5),
        (r"\bfor\s*official\s*use\s*only\b", 2.0),
        (r"\bcheckbox\b", 1.5),
    ],
}

_HARD_TOKEN = re.compile(r"[^a-z0-9\s#/:.\-]")


def _normalize(text: str) -> str:
    return _HARD_TOKEN.sub(" ", (text or "").lower())


class HeuristicClassifier(DocumentClassifier):
    """Deterministic keyword + structure scoring. Works fully offline."""

    name = "heuristic"

    def available(self) -> bool:
        return True

    def classify(self, text: str, image=None) -> ClassificationResult:
        haystack = _normalize(text)
        scores: dict[str, float] = {cls: 0.0 for cls in DOCUMENT_CLASSES}

        for doc_type, patterns in _KEYWORDS.items():
            for pattern, weight in patterns:
                hits = len(re.findall(pattern, haystack))
                if hits:
                    scores[doc_type] += weight * min(hits, 3)

        # Structural signals
        if re.search(r"\b\d{2}[a-z]{5}\d{4}[a-z][a-z0-9]z[a-z0-9]\b", haystack):
            scores["invoice"] += 1.5  # GSTIN strongly implies invoice/tax doc
        if re.search(r"\b(inr|₹|rs\.)\b", haystack):
            scores["invoice"] += 0.6
        line_count = len([l for l in (text or "").splitlines() if l.strip()])
        if 0 < line_count <= 25 and scores["invoice"] == 0:
            scores["receipt"] += 0.8  # short slips look receipt-like
        if len(haystack) > 2500 and "signature" in haystack:
            scores["contract"] += 0.8

        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        top_type, top_score = ranked[0]
        second_score = ranked[1][1]

        if top_score <= 0:
            return ClassificationResult("other", 0.35, model=self.name, scores=scores)

        if top_score < 2.0:
            # Weak evidence — keep "other"/top but with low confidence → triggers review.
            conf = min(0.55, 0.3 + top_score * 0.1)
            return ClassificationResult(top_type, conf, model=self.name, scores=scores)

        # Separation between top-1 and top-2 drives confidence.
        separation = (top_score - second_score) / max(top_score, 1e-6)
        conf = min(0.99, 0.62 + 0.35 * separation + min(top_score, 8) * 0.01)
        return ClassificationResult(top_type, round(conf, 3), model=self.name, scores=scores)


# ------------------------------------------------------------------------- ONNX
class OnnxClassifier(DocumentClassifier):
    """Optional local ONNX classifier slot.

    Expects models/classifier/model.onnx (single logits output over
    DOCUMENT_CLASSES) plus models/classifier/vocab.json (token -> index).
    Input: hashed bag-of-words vector of len(vocab).
    When files are missing, `available()` is False and the pipeline falls back
    to the heuristic — the app never becomes unusable.
    """

    name = "onnx"

    def __init__(self, model_dir: Path | None = None):
        self.model_dir = model_dir or (settings.model_path / "classifier")
        self._session = None
        self._vocab: dict[str, int] | None = None

    def available(self) -> bool:
        return (self.model_dir / "model.onnx").exists() and (
            self.model_dir / "vocab.json"
        ).exists()

    def _load(self):
        if self._session is not None:
            return
        import numpy as np  # noqa: F401
        import onnxruntime as ort

        self._vocab = json.loads((self.model_dir / "vocab.json").read_text())
        self._session = ort.InferenceSession(
            str(self.model_dir / "model.onnx"), providers=["CPUExecutionProvider"]
        )

    def classify(self, text: str, image=None) -> ClassificationResult:
        if not self.available():
            raise FileNotFoundError("onnx classifier not installed")
        import numpy as np

        self._load()
        tokens = _normalize(text).split()
        vector = np.zeros((1, len(self._vocab)), dtype=np.float32)
        for token in tokens:
            idx = self._vocab.get(token)
            if idx is not None:
                vector[0, idx] += 1.0
        input_name = self._session.get_inputs()[0].name
        logits = self._session.run(None, {input_name: vector})[0]
        probs = _softmax(logits[0])
        top = int(np.argmax(probs))
        return ClassificationResult(
            DOCUMENT_CLASSES[top], float(probs[top]), model="onnx-local",
            scores={cls: float(p) for cls, p in zip(DOCUMENT_CLASSES, probs)},
        )


def _softmax(values):
    import math

    mx = max(values)
    exps = [math.exp(float(v) - mx) for v in values]
    total = sum(exps)
    return [e / total for e in exps]


def get_classifier() -> DocumentClassifier:
    """Prefer a real local ONNX model; always keep the heuristic fallback."""
    onnx = OnnxClassifier()
    if onnx.available():
        return onnx
    return HeuristicClassifier()
