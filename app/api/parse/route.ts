import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { forwardPdfToParser } from "@/lib/parser-client";
import { persistParsedStatement } from "@/lib/statement-imports";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parserFile = new File([bytes], file.name, { type: file.type || "application/pdf" });
    const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const parsed = await forwardPdfToParser(parserFile);
    const statementImport = await persistParsedStatement(file.name, parsed, fileHash);
    return NextResponse.json({
      ...parsed,
      statementImportId: statementImport.id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parsing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
