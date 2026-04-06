"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadCategoryRules, loadCombinedLocalParsed, loadOneOffOverrides, readStorageJson } from "@/lib/client-finance-state";
import {
  CATEGORY_OPTIONS,
  CATEGORY_RULES_STORAGE_KEY,
  normalizeDescriptionKey,
  resolveCategory,
  transactionOverrideKey,
  type CategoryName,
  type CategoryRuleMap,
  type OneOffCategoryOverrideMap
} from "@/lib/category-utils";
import {
  IGNORED_TEACH_TRANSACTIONS_KEY,
  ONE_OFF_CATEGORY_OVERRIDES_KEY,
  REIMBURSEMENT_EXCLUSIONS_KEY,
  type ParseResponse
} from "@/lib/types";
import type { TransactionExclusionMap } from "@/lib/category-utils";

type ReviewTransactionRow = {
  key: string;
  date: string;
  description: string;
  amount: number;
  direction: "Incoming" | "Outgoing";
  currentCategory: string;
  normalized: string;
  excluded: boolean;
};

type MonthFilterOption = {
  key: string;
  label: string;
};

export function CategoryReviewClient() {
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [rules, setRules] = useState<CategoryRuleMap>({});
  const [oneOffOverrides, setOneOffOverrides] = useState<OneOffCategoryOverrideMap>({});
  const [reimbursementExclusions, setReimbursementExclusions] = useState<TransactionExclusionMap>({});
  const [ignoredTeachTransactions, setIgnoredTeachTransactions] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, CategoryName>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [selectedMonthKey, setSelectedMonthKey] = useState("all");

  useEffect(() => {
    async function hydrate() {
      const localParsed = loadCombinedLocalParsed();
      let persistedParsed: ParseResponse | null = null;

      try {
        const response = await fetch("/api/dashboard-data", { cache: "no-store" });
        const json = (await response.json()) as { parsed: ParseResponse | null };
        persistedParsed = json.parsed;
      } catch {
        persistedParsed = null;
      }

      setParsed(persistedParsed ?? localParsed);
      setRules(await loadCategoryRules());
      setOneOffOverrides(loadOneOffOverrides());
      setReimbursementExclusions(readStorageJson<TransactionExclusionMap>(REIMBURSEMENT_EXCLUSIONS_KEY) ?? {});
      setIgnoredTeachTransactions(readStorageJson<Record<string, boolean>>(IGNORED_TEACH_TRANSACTIONS_KEY) ?? {});
    }

    void hydrate();
  }, []);

  const monthOptions = useMemo<MonthFilterOption[]>(
    () =>
      parsed
        ? [
            { key: "all", label: "All months" },
            ...[...new Set(parsed.transactions.map((transaction) => transaction.date.slice(0, 7)))]
              .sort((a, b) => b.localeCompare(a))
              .map((key) => ({
                key,
                label: new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(
                  new Date(`${key}-01T00:00:00`)
                )
              }))
          ]
        : [{ key: "all", label: "All months" }],
    [parsed]
  );

  const reviewRows = useMemo<ReviewTransactionRow[]>(
    () =>
      parsed
        ? [...parsed.transactions]
            .filter((transaction) => selectedMonthKey === "all" || transaction.date.startsWith(selectedMonthKey))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((transaction) => {
              const key = transactionOverrideKey(transaction);
              const normalized = normalizeDescriptionKey(transaction.description);
              const currentCategory =
                oneOffOverrides[key] ??
                transaction.category ??
                resolveCategory(transaction.description, rules);

              return {
                key,
                date: transaction.date,
                description: transaction.description,
                amount: transaction.amount,
                direction: (transaction.amount >= 0 ? "Incoming" : "Outgoing") as ReviewTransactionRow["direction"],
                currentCategory,
                normalized,
                excluded: Boolean(reimbursementExclusions[key])
              };
            })
            .filter((row) => row.currentCategory === "General" && !ignoredTeachTransactions[row.key])
        : [],
    [parsed, rules, oneOffOverrides, reimbursementExclusions, ignoredTeachTransactions, selectedMonthKey]
  );

  async function saveRule(description: string, category: CategoryName) {
    setSavingKey(description);
    setMessage("");

    const response = await fetch("/api/category-rules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ description, category })
    });

    const json = (await response.json()) as { rules?: CategoryRuleMap; error?: string };

    if (!response.ok || !json.rules) {
      setMessage(json.error ?? "Could not save category rule.");
      setSavingKey(null);
      return;
    }

    setRules(json.rules);
    localStorage.setItem(CATEGORY_RULES_STORAGE_KEY, JSON.stringify(json.rules));
    window.dispatchEvent(new Event("category-rules-updated"));
    setSavingKey(null);
    setMessage(`Saved "${description}" as ${category}. Future dashboard views will use it automatically.`);
  }

  function saveOneOffOverride(row: ReviewTransactionRow, category: CategoryName) {
    const nextOverrides = {
      ...oneOffOverrides,
      [row.key]: category
    };

    setOneOffOverrides(nextOverrides);
    localStorage.setItem(ONE_OFF_CATEGORY_OVERRIDES_KEY, JSON.stringify(nextOverrides));
    window.dispatchEvent(new Event("category-rules-updated"));
    setMessage(
      `Applied ${category} only to ${row.description} on ${row.date}. Future transactions with the same description will keep their normal rule.`
    );
  }

  function ignoreTeachRow(row: ReviewTransactionRow) {
    const next = {
      ...ignoredTeachTransactions,
      [row.key]: true
    };

    setIgnoredTeachTransactions(next);
    localStorage.setItem(IGNORED_TEACH_TRANSACTIONS_KEY, JSON.stringify(next));
    setMessage(`Ignored ${row.description} on ${row.date} in the teach table.`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-[2rem] border border-ink/10 bg-panel/85 p-8 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Categories</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">Teach the dashboard only what is new</h1>
            <p className="mt-3 max-w-3xl text-sm text-ink/70 md:text-base">
              This page shows uncategorized transactions from your saved statements. Use
              <span className="font-medium"> Apply once </span>
              for a single payment, or
              <span className="font-medium"> Apply forever </span>
              when the description should keep the same category in future.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-ink/15 transition hover:bg-sand/30"
              href="/transactions"
            >
              View raw transactions
            </Link>
            <Link className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90" href="/">
              Back to dashboard
            </Link>
          </div>
        </div>

        {message ? <div className="mt-6 rounded-[1.25rem] bg-sand/50 p-4 text-sm text-ink/75">{message}</div> : null}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-panel/90 shadow-card">
        <div className="border-b border-ink/10 bg-panel/80 px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-medium text-ink">Teach table</p>
              <p className="mt-1 text-sm text-ink/65">
                Transactions with existing permanent rules stay hidden here so you only see unresolved items. Excluded rows
                can be ignored if they are reimbursement or split-bill noise.
              </p>
            </div>
            <label className="text-sm text-ink/65">
              <span className="mb-2 block font-medium text-ink">Month</span>
              <select
                className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink"
                onChange={(event) => setSelectedMonthKey(event.target.value)}
                value={selectedMonthKey}
              >
                {monthOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand/60 text-ink/60">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Direction</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Choose Category</th>
                <th className="px-4 py-3 font-medium text-right">Apply Once</th>
                <th className="px-4 py-3 font-medium text-right">Apply Forever</th>
                <th className="px-4 py-3 font-medium text-right">Ignore</th>
              </tr>
            </thead>
            <tbody className="bg-white/75">
              {reviewRows.length > 0 ? (
                reviewRows.map((row) => {
                  const currentValue =
                    drafts[row.key] ??
                    drafts[row.normalized] ??
                    ("General" as CategoryName);

                  return (
                    <tr key={row.key} className="border-t border-ink/5">
                      <td className="px-4 py-4 whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-4">
                        {row.description}
                        {row.excluded ? <span className="ml-2 rounded-full bg-[#fff1ea] px-2 py-1 text-xs text-[#8d4f34]">Excluded in raw</span> : null}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={
                            row.direction === "Incoming"
                              ? "rounded-full bg-[#e8f7f0] px-3 py-1 text-xs font-medium text-accent"
                              : "rounded-full bg-[#fff1ea] px-3 py-1 text-xs font-medium text-[#8d4f34]"
                          }
                        >
                          {row.direction}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">{row.amount.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <select
                          className="rounded-full border border-ink/15 bg-white px-3 py-2"
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.key]: event.target.value as CategoryName,
                              [row.normalized]: event.target.value as CategoryName
                            }))
                          }
                          value={currentValue}
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
                          onClick={() => saveOneOffOverride(row, currentValue)}
                          type="button"
                        >
                          Apply once
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-ink/15 transition hover:bg-sand/30 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={savingKey === row.description}
                          onClick={() => void saveRule(row.description, currentValue)}
                          type="button"
                        >
                          {savingKey === row.description ? "Saving..." : "Apply forever"}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          className="rounded-full px-4 py-2 text-sm font-medium text-[#8d4f34] ring-1 ring-[#d98d69]/30 transition hover:bg-[#fff1ea] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!row.excluded}
                          onClick={() => ignoreTeachRow(row)}
                          type="button"
                        >
                          Ignore
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-ink/5">
                  <td className="px-4 py-10 text-center text-ink/60" colSpan={8}>
                    {parsed
                      ? selectedMonthKey === "all"
                        ? "Everything in your saved statements is already covered by a one-off choice or a permanent rule."
                        : "Everything in this month is already covered by a one-off choice or a permanent rule."
                      : "Upload a statement first and this table will show only the transactions that still need a category."}
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
