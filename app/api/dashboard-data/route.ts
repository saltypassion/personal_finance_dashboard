import { NextResponse } from "next/server";
import { listPersistedTransactions } from "@/lib/statement-imports";

export async function GET() {
  try {
    const transactions = await listPersistedTransactions();

    if (transactions.length === 0) {
      return NextResponse.json({
        parsed: null
      });
    }

    const latest = transactions.at(-1);
    const statementCount = new Set(
      transactions.map((transaction) => transaction.statementImportId).filter((value): value is string => Boolean(value))
    ).size;

    return NextResponse.json({
      statementCount,
      parsed: {
        institution: latest?.account.institutionName ?? "Uploaded statements",
        account_name: latest?.account.accountName ?? null,
        transactions: transactions.map((transaction) => ({
          date: transaction.postedAt.toISOString().slice(0, 10),
          description: transaction.description,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          category: transaction.category,
          balance: null
        })),
        summary: null,
        insights: [],
        warnings: []
      }
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Failed to load dashboard data.";
    const message =
      rawMessage.includes("Can't reach database server") || rawMessage.includes("localhost:5432")
        ? "The database looks offline. Start PostgreSQL with `docker compose up -d`, then refresh this page."
        : "Could not load saved dashboard data right now.";

    return NextResponse.json({ error: message, parsed: null, statementCount: 0 }, { status: 500 });
  }
}
