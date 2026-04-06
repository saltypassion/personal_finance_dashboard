"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import {
  LAST_PARSED_TRANSACTIONS_KEY,
  PARSED_STATEMENT_HISTORY_KEY,
  type ParseResponse,
  type StoredParsedStatement
} from "@/lib/types";

type UploadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: ParseResponse };

export function UploadCard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadState({ status: "error", message: "Choose a PDF statement first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    setUploadState({ status: "loading" });

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        body: formData
      });
      const json = (await response.json()) as ParseResponse | { error: string };

      if (!response.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "Upload failed");
      }

      localStorage.setItem(LAST_PARSED_TRANSACTIONS_KEY, JSON.stringify(json));
      const storedHistory = localStorage.getItem(PARSED_STATEMENT_HISTORY_KEY);
      const history = storedHistory ? (JSON.parse(storedHistory) as StoredParsedStatement[]) : [];
      const statementId =
        json.statementImportId ?? `${selectedFile.name}-${json.transactions[0]?.date ?? "empty"}-${json.transactions.length}`;
      const nextHistory = [
        ...history.filter((entry) => entry.id !== statementId),
        {
          id: statementId,
          filename: selectedFile.name,
          uploadedAt: new Date().toISOString(),
          parsed: json
        }
      ].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
      localStorage.setItem(PARSED_STATEMENT_HISTORY_KEY, JSON.stringify(nextHistory));
      window.dispatchEvent(new Event("uploaded-statements-updated"));
      setUploadState({ status: "success", data: json });
    } catch (error) {
      setUploadState({
        status: "error",
        message: error instanceof Error ? error.message : "Upload failed"
      });
    }
  }

  const parsedData = uploadState.status === "success" ? uploadState.data : null;

  return (
    <section className="rounded-[2rem] border border-dashed border-ink/20 bg-white/70 p-6 shadow-card">
      <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Import</p>
      <h2 className="mt-2 font-display text-3xl">Upload a statement PDF</h2>
      <p className="mt-3 text-sm text-ink/70">
        Pick a bank statement and we&apos;ll send it through the parser service so you can inspect the extracted rows.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block rounded-[1.5rem] border border-ink/15 bg-panel/80 p-4 text-sm text-ink/70">
          <span className="mb-3 block font-medium text-ink">Statement PDF</span>
          <input
            accept="application/pdf"
            className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-accent/90"
            onChange={handleFileChange}
            type="file"
          />
        </label>

        <button
          className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/40"
          disabled={uploadState.status === "loading"}
          type="submit"
        >
          {uploadState.status === "loading" ? "Parsing..." : "Upload and Parse"}
        </button>
      </form>

      {selectedFile ? (
        <div className="mt-4 rounded-[1.25rem] bg-sand/50 p-4 text-sm text-ink/75">
          Selected file: <span className="font-medium text-ink">{selectedFile.name}</span>
        </div>
      ) : null}

      {uploadState.status === "error" ? (
        <div className="mt-4 rounded-[1.25rem] border border-[#d98d69]/30 bg-[#fff1ea] p-4 text-sm text-[#8d4f34]">
          {uploadState.message}
        </div>
      ) : null}

      {parsedData ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-[1.5rem] bg-sand/50 p-4">
            <p className="font-medium text-ink">{parsedData.institution}</p>
            <p className="mt-1 text-sm text-ink/65">
              Parsed {parsedData.transactions.length} transaction
              {parsedData.transactions.length === 1 ? "" : "s"}.
            </p>
            <Link className="mt-3 inline-block text-sm font-medium text-accent hover:underline" href="/transactions">
              Open raw transactions page
            </Link>
            <Link className="mt-3 ml-4 inline-block text-sm font-medium text-accent hover:underline" href="/uploads">
              View upload history
            </Link>
          </div>

          {parsedData.summary ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.25rem] bg-panel/90 p-4 text-sm text-ink/70">
                <p className="font-medium text-ink">Statement summary</p>
                <p className="mt-2">Opening: S${parsedData.summary.opening_balance?.toFixed(2) ?? "-"}</p>
                <p>Incoming: S${parsedData.summary.total_incoming?.toFixed(2) ?? "-"}</p>
                <p>Outgoing: S${parsedData.summary.total_outgoing?.toFixed(2) ?? "-"}</p>
                <p>Interest: S${parsedData.summary.interest?.toFixed(2) ?? "-"}</p>
                <p>Closing: S${parsedData.summary.closing_balance?.toFixed(2) ?? "-"}</p>
              </div>
              {parsedData.insights.length > 0 ? (
                <div className="rounded-[1.25rem] bg-panel/90 p-4 text-sm text-ink/70">
                  <p className="font-medium text-ink">Quick insights</p>
                  <ul className="mt-2 space-y-2">
                    {parsedData.insights.slice(0, 3).map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {parsedData.warnings.length > 0 ? (
            <div className="rounded-[1.25rem] border border-[#d9c27a]/40 bg-[#fff8df] p-4 text-sm text-[#7c6420]">
              {parsedData.warnings.join(" ")}
            </div>
          ) : null}

          <div className="max-h-72 overflow-auto rounded-[1.25rem] border border-ink/10 bg-white/80">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel text-ink/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.transactions.length > 0 ? (
                  parsedData.transactions.map((transaction, index) => (
                    <tr key={`${transaction.date}-${transaction.description}-${index}`} className="border-t border-ink/5">
                      <td className="px-4 py-3">{transaction.date}</td>
                      <td className="px-4 py-3">{transaction.description}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {transaction.amount.toFixed(2)} {transaction.currency}
                      </td>
                      <td className="px-4 py-3 text-right text-ink/70">
                        {transaction.balance == null ? "-" : `${transaction.balance.toFixed(2)} ${transaction.currency}`}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-4 text-ink/60" colSpan={4}>
                      No transactions were extracted from this file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
