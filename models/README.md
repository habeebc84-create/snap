# SecureDoc AI — local models

This directory holds optional local models. **Nothing here is required**: the
offline MVP ships deterministic fallbacks so the app runs from a fresh install
with no downloads and no API keys.

```text
models/
├── classifier/
│   ├── model.onnx     # optional: logits over the 6 document classes
│   └── vocab.json     # optional: {"token": index, ...} bag-of-words vocabulary
├── extraction/
│   └── (reserved for future sequence-labeling extractors)
└── README.md
```

## Registry

| Model | Runtime | Default implementation | Swap-in path |
|---|---|---|---|
| OCR Engine | Tesseract | `pytesseract`, engine behind `OCRProvider` | implement `OCRProvider` for PaddleOCR/EasyOCR/QNN |
| Document Classifier | ONNX (optional) | `HeuristicClassifier` (keyword + structure scoring) | drop `model.onnx` + `vocab.json` in `classifier/` |
| Extraction | rules + regex | `InvoiceExtractor` / `ReceiptExtractor` | register a new `DocumentExtractor` |

Check status:

```bash
.venv/bin/python scripts/download_models.py
.venv/bin/python scripts/download_models.py --install path/to/model.onnx path/to/vocab.json
```

If a model file is missing, the UI shows *"Model unavailable — using
deterministic local fallback"* and the pipeline keeps working.
