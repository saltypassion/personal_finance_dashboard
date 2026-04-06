"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { UploadedStatementRecord } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function UploadHistoryClient() {
  const [records, setRecords] = useState<UploadedStatementRecord[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function hydrate() {
      try {
        setError("");
        const response = await fetch("/api/uploads", { cache: "no-store" });
        const text = await response.text();
        const json = text ? (JSON.parse(text) as { uploads?: UploadedStatementRecord[]; error?: string }) : {};

        if (!response.ok) {
          throw new Error(json.error ?? "Failed to load upload history.");
        }

        setRecords(json.uploads ?? []);
      } catch (fetchError) {
        setRecords([]);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load upload history.");
      }
    }

    const handleUploadedStatementsUpdated = () => {
      void hydrate();
    };

    void hydrate();
    window.addEventListener("uploaded-statements-updated", handleUploadedStatementsUpdated);

    return () => {
      window.removeEventListener("uploaded-statements-updated", handleUploadedStatementsUpdated);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-[2rem] border border-ink/10 bg-panel/85 p-8 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Uploads</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">Statement upload history</h1>
            <p className="mt-3 max-w-3xl text-sm text-ink/70 md:text-base">
              Check which statement PDFs you&apos;ve already submitted, when they were uploaded, and the statement period they covered.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90" href="/">
              Back to dashboard
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-[1.25rem] border border-[#d98d69]/30 bg-[#fff1ea] p-4 text-sm text-[#8d4f34]">
            <p>{error}</p>
            {error.includes("docker compose up -d") ? (
              <p className="mt-2 text-[#8d4f34]/80">
                After the database is running, refresh this page. If you uploaded statements before the DB-backed history
                existed, upload them once more and they&apos;ll appear here.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-panel/90 shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand/60 text-ink/60">
              <tr>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Statement Period</th>
                <th className="px-4 py-3 font-medium text-right">Transactions</th>
              </tr>
            </thead>
            <tbody className="bg-white/75">
              {records.length > 0 ? (
                records.map((record) => (
                  <tr key={record.id} className="border-t border-ink/5">
                    <td className="px-4 py-4">{record.filename}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDate(record.uploadedAt)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{record.institution}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {record.statementStartDate && record.statementEndDate
                        ? `${record.statementStartDate} to ${record.statementEndDate}`
                        : "Unknown"}
                    </td>
                    <td className="px-4 py-4 text-right">{record.transactionCount}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-ink/5">
                  <td className="px-4 py-10 text-center text-ink/60" colSpan={5}>
                    No statement uploads recorded yet. Upload a PDF from the dashboard and it will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
