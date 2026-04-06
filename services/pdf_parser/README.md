# PDF Parser Service

This FastAPI service accepts a statement PDF and extracts rows in three passes:

- `pdfplumber` table extraction for cleaner statement PDFs
- `pdfplumber` text-line extraction as a fallback
- OCR fallback for rendered/scanned PDFs such as Trust statement exports

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
