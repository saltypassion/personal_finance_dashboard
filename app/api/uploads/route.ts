import { NextResponse } from "next/server";
import { listStatementImports } from "@/lib/statement-imports";

export async function GET() {
  try {
    const imports = await listStatementImports();

    return NextResponse.json({
      uploads: imports.map((statementImport) => ({
        id: statementImport.id,
        filename: statementImport.sourceFilename,
        uploadedAt: statementImport.importedAt.toISOString(),
        transactionCount: statementImport.transactionCount,
        institution: statementImport.account.institutionName,
        statementStartDate: statementImport.statementStartDate?.toISOString().slice(0, 10) ?? null,
        statementEndDate: statementImport.statementEndDate?.toISOString().slice(0, 10) ?? null
      }))
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Failed to load upload history.";
    const message =
      rawMessage.includes("Can't reach database server") || rawMessage.includes("localhost:5432")
        ? "The database looks offline. Start PostgreSQL with `docker compose up -d`, then refresh this page."
        : "Could not load upload history right now.";
    return NextResponse.json({ error: message, uploads: [] }, { status: 500 });
  }
}
