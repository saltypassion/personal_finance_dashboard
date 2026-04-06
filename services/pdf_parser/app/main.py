from fastapi import FastAPI, File, HTTPException, UploadFile

from .parser import parse_statement

app = FastAPI(title="PDF Parser Service")


@app.get("/health")
async def healthcheck():
    return {"status": "ok"}


@app.post("/parse")
async def parse(file: UploadFile = File(...)):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    pdf_bytes = await file.read()
    result = parse_statement(pdf_bytes)
    return result.model_dump()
