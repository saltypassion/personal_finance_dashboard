"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  loadCategoryRules,
  loadOneOffOverrides,
  readStorageJson
} from "@/lib/client-finance-state";
import {
  LAST_PARSED_TRANSACTIONS_KEY,
  ONE_OFF_CATEGORY_OVERRIDES_KEY,
  REIMBURSEMENT_EXCLUSIONS_KEY,
  SPLIT_ADJUSTMENTS_KEY,
  type ParseResponse,
  type ParsedTransaction,
  type StatementSummary
} from "@/lib/types";
import {
  CATEGORY_OPTIONS,
  CATEGORY_RULES_STORAGE_KEY,
  resolveCategory,
  type CategoryName,
  type CategoryRuleMap,
  type OneOffCategoryOverrideMap,
  transactionOverrideKey,
  type TransactionExclusionMap,
  type TransactionSplitAdjustmentMap
} from "@/lib/category-utils";

type RawRow = {
  id: string;
  exclusionKey: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  balance: string;
  source: string;
  currentCategory: string;
};

type PeriodOption = {
  key: string;
  year: string;
  month: string;
  label: string;
};

type DerivedPeriodSummary = {
  opening: number | null;
  incoming: number;
  outgoing: number;
  closing: number | null;
  netFlow: number;
};

function parsedRows(
  data: ParseResponse,
  rules: CategoryRuleMap,
  oneOffOverrides: OneOffCategoryOverrideMap
): RawRow[] {
  return data.transactions.map((transaction: ParsedTransaction, index) => ({
    id: `${transaction.date}-${index}`,
    exclusionKey: transactionOverrideKey(transaction),
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    currency: transaction.currency,
    balance: transaction.balance == null ? "-" : transaction.balance.toFixed(2),
    source: data.institution,
    currentCategory:
      oneOffOverrides[transactionOverrideKey(transaction)] ??
      transaction.category ??
      resolveCategory(transaction.description, rules)
  }));
}

export function RawTransactionsView() {
  const [rows, setRows] = useState<RawRow[]>([]);
  const [reimbursementExclusions, setReimbursementExclusions] = useState<TransactionExclusionMap>({});
  const [splitAdjustments, setSplitAdjustments] = useState<TransactionSplitAdjustmentMap>({});
  const [splitDrafts, setSplitDrafts] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<CategoryRuleMap>({});
  const [oneOffOverrides, setOneOffOverrides] = useState<OneOffCategoryOverrideMap>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryName>>({});
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [openAdjustmentKey, setOpenAdjustmentKey] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [meta, setMeta] = useState<{ title: string; subtitle: string }>({
    title: "No uploaded data yet",
    subtitle: "Upload a statement from the dashboard and the latest parsed result will appear here."
  });

  useEffect(() => {
    async function hydrate() {
      const raw = readStorageJson<ParseResponse>(LAST_PARSED_TRANSACTIONS_KEY);

      setReimbursementExclusions(readStorageJson<TransactionExclusionMap>(REIMBURSEMENT_EXCLUSIONS_KEY) ?? {});
      const parsedAdjustments = readStorageJson<TransactionSplitAdjustmentMap>(SPLIT_ADJUSTMENTS_KEY);
      if (parsedAdjustments) {
        setSplitAdjustments(parsedAdjustments);
        setSplitDrafts(
          Object.fromEntries(
            Object.entries(parsedAdjustments).map(([key, value]) => [key, Math.abs(value).toFixed(2)])
          )
        );
      }
      const nextRules = await loadCategoryRules();
      const nextOverrides = loadOneOffOverrides();
      setOneOffOverrides(nextOverrides);
      setRules(nextRules);

      if (raw) {
        setSummary(raw.summary ?? null);
        setInsights(raw.insights ?? []);
      }

      try {
        const response = await fetch("/api/dashboard-data", { cache: "no-store" });
        const json = (await response.json()) as { parsed: ParseResponse | null };

        if (json.parsed) {
          setRows(parsedRows(json.parsed, nextRules, nextOverrides));
          setMeta({
            title: `Showing saved data from ${json.parsed.institution}`,
            subtitle: `${json.parsed.transactions.length} saved row${json.parsed.transactions.length === 1 ? "" : "s"} across your uploaded statements.`
          });
          return;
        }
      } catch {
        // Fall through to latest local parse if the database is unavailable.
      }

      if (raw) {
        setRows(parsedRows(raw, nextRules, nextOverrides));
        setMeta({
          title: `Showing parsed data from ${raw.institution}`,
          subtitle: `${raw.transactions.length} row${raw.transactions.length === 1 ? "" : "s"} from your last upload.`
        });
      }
    }

    void hydrate();
  }, []);

  const periodOptions = useMemo<PeriodOption[]>(() => {
    const seen = new Set<string>();

    return [...rows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((row) => {
        const [year, month] = row.date.split("-");
        const key = `${year}-${month}`;

        if (seen.has(key) || !year || !month) {
          return [];
        }

        seen.add(key);
        return [
          {
            key,
            year,
            month,
            label: new Intl.DateTimeFormat("en-SG", {
              month: "long"
            }).format(new Date(`${key}-01T00:00:00`))
          }
        ];
      });
  }, [rows]);

  useEffect(() => {
    if (periodOptions.length === 0) {
      setSelectedYear("");
      setSelectedMonth("");
      return;
    }

    const hasSelectedPeriod = periodOptions.some(
      (option) => option.year === selectedYear && option.month === selectedMonth
    );

    if (!hasSelectedPeriod) {
      setSelectedYear(periodOptions[0].year);
      setSelectedMonth(periodOptions[0].month);
    }
  }, [periodOptions, selectedYear, selectedMonth]);

  const yearOptions = useMemo(
    () => [...new Set(periodOptions.map((option) => option.year))].sort((a, b) => b.localeCompare(a)),
    [periodOptions]
  );

  const monthOptions = useMemo(
    () => periodOptions.filter((option) => option.year === selectedYear),
    [periodOptions, selectedYear]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const [year, month] = row.date.split("-");
        return (!selectedYear || year === selectedYear) && (!selectedMonth || month === selectedMonth);
      }),
    [rows, selectedMonth, selectedYear]
  );

  const selectedPeriodLabel = useMemo(() => {
    const match = periodOptions.find((option) => option.year === selectedYear && option.month === selectedMonth);
    return match?.label ?? "Selected period";
  }, [periodOptions, selectedMonth, selectedYear]);

  const derivedSummary = useMemo<DerivedPeriodSummary | null>(() => {
    if (filteredRows.length === 0) {
      return null;
    }

    const numericBalances = filteredRows
      .map((row) => (row.balance === "-" ? null : Number(row.balance)))
      .filter((value): value is number => value != null && Number.isFinite(value));

    const incoming = filteredRows
      .filter((row) => row.amount > 0)
      .reduce((sum, row) => sum + row.amount, 0);
    const outgoing = filteredRows
      .filter((row) => row.amount < 0)
      .reduce((sum, row) => sum + Math.abs(row.amount), 0);

    return {
      opening: numericBalances[0] ?? null,
      incoming,
      outgoing,
      closing: numericBalances.at(-1) ?? null,
      netFlow: incoming - outgoing
    };
  }, [filteredRows]);

  const displayedInsights = useMemo(() => {
    if (filteredRows.length === 0) {
      return [];
    }

    const largestIncoming = [...filteredRows]
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)[0];
    const largestOutgoing = [...filteredRows]
      .filter((row) => row.amount < 0)
      .sort((a, b) => a.amount - b.amount)[0];

    const nextInsights = [
      derivedSummary
        ? derivedSummary.netFlow >= 0
          ? `${selectedPeriodLabel} finished ${derivedSummary.netFlow.toFixed(2)} SGD positive.`
          : `${selectedPeriodLabel} finished ${Math.abs(derivedSummary.netFlow).toFixed(2)} SGD negative.`
        : null,
      largestIncoming
        ? `Largest incoming was ${largestIncoming.description} for ${largestIncoming.amount.toFixed(2)} ${largestIncoming.currency}.`
        : null,
      largestOutgoing
        ? `Largest outgoing was ${largestOutgoing.description} for ${Math.abs(largestOutgoing.amount).toFixed(2)} ${largestOutgoing.currency}.`
        : null
    ].filter((value): value is string => Boolean(value));

    return nextInsights.length > 0 ? nextInsights : insights;
  }, [derivedSummary, filteredRows, insights, selectedPeriodLabel]);

  function toggleReimbursement(row: RawRow) {
    const next = {
      ...reimbursementExclusions,
      [row.exclusionKey]: !reimbursementExclusions[row.exclusionKey]
    };

    if (!next[row.exclusionKey]) {
      delete next[row.exclusionKey];
    }

    setReimbursementExclusions(next);
    localStorage.setItem(REIMBURSEMENT_EXCLUSIONS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("category-rules-updated"));
  }

  function saveSplitAdjustment(row: RawRow) {
    const rawValue = splitDrafts[row.exclusionKey];
    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return;
    }

    const signedValue = row.amount < 0 ? -parsedValue : parsedValue;
    const next = {
      ...splitAdjustments,
      [row.exclusionKey]: signedValue
    };

    setSplitAdjustments(next);
    localStorage.setItem(SPLIT_ADJUSTMENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("category-rules-updated"));
  }

  function clearSplitAdjustment(row: RawRow) {
    const next = { ...splitAdjustments };
    delete next[row.exclusionKey];
    setSplitAdjustments(next);
    localStorage.setItem(SPLIT_ADJUSTMENTS_KEY, JSON.stringify(next));
    setSplitDrafts((current) => {
      const updated = { ...current };
      delete updated[row.exclusionKey];
      return updated;
    });
    window.dispatchEvent(new Event("category-rules-updated"));
  }

  function saveCategoryOverride(row: RawRow) {
    const nextCategory = categoryDrafts[row.exclusionKey] ?? (row.currentCategory as CategoryName);
    const nextOverrides = {
      ...oneOffOverrides,
      [row.exclusionKey]: nextCategory
    };

    setOneOffOverrides(nextOverrides);
    localStorage.setItem(ONE_OFF_CATEGORY_OVERRIDES_KEY, JSON.stringify(nextOverrides));
    setRows((current) =>
      current.map((item) =>
        item.exclusionKey === row.exclusionKey
          ? {
              ...item,
              currentCategory: nextCategory
            }
          : item
      )
    );
    window.dispatchEvent(new Event("category-rules-updated"));
  }

  function clearCategoryOverride(row: RawRow) {
    const nextOverrides = { ...oneOffOverrides };
    delete nextOverrides[row.exclusionKey];

    setOneOffOverrides(nextOverrides);
    localStorage.setItem(ONE_OFF_CATEGORY_OVERRIDES_KEY, JSON.stringify(nextOverrides));
    setCategoryDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[row.exclusionKey];
      return nextDrafts;
    });
    setRows((current) =>
      current.map((item) =>
        item.exclusionKey === row.exclusionKey
          ? {
              ...item,
              currentCategory: resolveCategory(item.description, rules)
            }
          : item
      )
    );
    window.dispatchEvent(new Event("category-rules-updated"));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-[2rem] border border-ink/10 bg-panel/85 p-8 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Raw Data</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">Transactions table</h1>
            <p className="mt-3 max-w-3xl text-sm text-ink/70 md:text-base">{meta.subtitle}</p>
          </div>
          <div className="flex gap-3">
            <Link
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-ink/15 transition hover:bg-sand/30"
              href="/categories"
            >
              Open teach table
            </Link>
            <Link
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
              href="/"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] bg-sand/50 p-4">
          <p className="font-medium text-ink">{meta.title}</p>
          <p className="mt-1 text-sm text-ink/65">
            This is intentionally raw so you can inspect dates, descriptions, amounts, and balances before we add save/review workflows.
          </p>
        </div>

        {periodOptions.length > 0 ? (
          <div className="mt-4 grid gap-3 rounded-[1.5rem] bg-panel/90 p-4 md:grid-cols-[0.8fr_1.2fr]">
            <label className="text-sm text-ink/70">
              <span className="mb-2 block font-medium text-ink">Year</span>
              <select
                className="w-full rounded-full border border-ink/15 bg-white px-4 py-3"
                onChange={(event) => {
                  const nextYear = event.target.value;
                  setSelectedYear(nextYear);
                  const firstMonth = periodOptions.find((option) => option.year === nextYear);
                  setSelectedMonth(firstMonth?.month ?? "");
                }}
                value={selectedYear}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink/70">
              <span className="mb-2 block font-medium text-ink">Month</span>
              <select
                className="w-full rounded-full border border-ink/15 bg-white px-4 py-3"
                onChange={(event) => setSelectedMonth(event.target.value)}
                value={selectedMonth}
              >
                {monthOptions.map((option) => (
                  <option key={option.key} value={option.month}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {summary || derivedSummary ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.5rem] bg-panel/90 p-4 text-sm text-ink/70">
              <p className="font-medium text-ink">Period summary</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p>Opening: S${derivedSummary?.opening?.toFixed(2) ?? summary?.opening_balance?.toFixed(2) ?? "-"}</p>
                <p>Incoming: S${derivedSummary?.incoming.toFixed(2) ?? summary?.total_incoming?.toFixed(2) ?? "-"}</p>
                <p>Outgoing: S${derivedSummary?.outgoing.toFixed(2) ?? summary?.total_outgoing?.toFixed(2) ?? "-"}</p>
                <p>Net flow: S${derivedSummary?.netFlow.toFixed(2) ?? "-"}</p>
                <p>Closing: S${derivedSummary?.closing?.toFixed(2) ?? summary?.closing_balance?.toFixed(2) ?? "-"}</p>
              </div>
            </div>
            {displayedInsights.length > 0 ? (
              <div className="rounded-[1.5rem] bg-panel/90 p-4 text-sm text-ink/70">
                <p className="font-medium text-ink">Insights</p>
                <ul className="mt-3 space-y-2">
                  {displayedInsights.map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-panel/90 shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand/60 text-ink/60">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Adjust</th>
              </tr>
            </thead>
            <tbody className="bg-white/75">
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => {
                  const hasSplitAdjustment = splitAdjustments[row.exclusionKey] != null;
                  const isExcluded = Boolean(reimbursementExclusions[row.exclusionKey]);
                  const isOpen = openAdjustmentKey === row.exclusionKey;

                  return (
                    <Fragment key={row.id}>
                      <tr key={row.id} className="border-t border-ink/5 align-top">
                        <td className="px-4 py-4 whitespace-nowrap">{row.date}</td>
                        <td className="min-w-[20rem] px-4 py-4">{row.description}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-ink/65">{row.source}</td>
                        <td
                          className={clsx(
                            "px-4 py-4 whitespace-nowrap text-right font-medium",
                            row.amount < 0 ? "text-[#a94d26]" : "text-accent"
                          )}
                        >
                          {row.amount.toFixed(2)} {row.currency}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-ink/10">
                            {row.currentCategory}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-2">
                            {hasSplitAdjustment ? (
                              <span className="rounded-full bg-sand/70 px-3 py-1.5 text-xs font-medium text-ink">
                                Split: {Math.abs(splitAdjustments[row.exclusionKey]).toFixed(2)}
                              </span>
                            ) : null}
                            {isExcluded ? (
                              <span className="rounded-full bg-[#fff1ea] px-3 py-1.5 text-xs font-medium text-[#8d4f34]">
                                Excluded
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#e8f7f0] px-3 py-1.5 text-xs font-medium text-accent">
                                Counted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <button
                            className="rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-medium text-ink transition hover:bg-sand/30"
                            onClick={() =>
                              setOpenAdjustmentKey((current) =>
                                current === row.exclusionKey ? null : row.exclusionKey
                              )
                            }
                            type="button"
                          >
                            {isOpen ? "Close" : "Adjust"}
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-t border-ink/5 bg-panel/40">
                          <td className="px-4 py-4" colSpan={7}>
                            <div className="grid gap-4 xl:grid-cols-[1.2fr_1.1fr_0.9fr]">
                              <div className="rounded-[1.25rem] bg-white/85 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink/45">Category</p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <select
                                    className="rounded-full border border-ink/15 bg-white px-3 py-2 text-xs"
                                    onChange={(event) =>
                                      setCategoryDrafts((current) => ({
                                        ...current,
                                        [row.exclusionKey]: event.target.value as CategoryName
                                      }))
                                    }
                                    value={(categoryDrafts[row.exclusionKey] ?? row.currentCategory) as CategoryName}
                                  >
                                    {CATEGORY_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    className="rounded-full bg-white px-3 py-2 text-xs font-medium text-ink ring-1 ring-ink/15 transition hover:bg-sand/30"
                                    onClick={() => saveCategoryOverride(row)}
                                    type="button"
                                  >
                                    Save category
                                  </button>
                                  {oneOffOverrides[row.exclusionKey] ? (
                                    <button
                                      className="rounded-full px-3 py-2 text-xs font-medium text-[#8d4f34] ring-1 ring-[#d98d69]/30 transition hover:bg-[#fff1ea]"
                                      onClick={() => clearCategoryOverride(row)}
                                      type="button"
                                    >
                                      Clear category
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="rounded-[1.25rem] bg-white/85 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink/45">Count This Much</p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <input
                                    className="w-28 rounded-full border border-ink/15 bg-white px-3 py-2 text-right text-xs"
                                    inputMode="decimal"
                                    onChange={(event) =>
                                      setSplitDrafts((current) => ({
                                        ...current,
                                        [row.exclusionKey]: event.target.value
                                      }))
                                    }
                                    placeholder={Math.abs(row.amount).toFixed(2)}
                                    value={
                                      splitDrafts[row.exclusionKey] ??
                                      (splitAdjustments[row.exclusionKey] != null
                                        ? Math.abs(splitAdjustments[row.exclusionKey]).toFixed(2)
                                        : "")
                                    }
                                  />
                                  <button
                                    className="rounded-full bg-white px-3 py-2 text-xs font-medium text-ink ring-1 ring-ink/15 transition hover:bg-sand/30"
                                    onClick={() => saveSplitAdjustment(row)}
                                    type="button"
                                  >
                                    Save split
                                  </button>
                                  {splitAdjustments[row.exclusionKey] != null ? (
                                    <button
                                      className="rounded-full px-3 py-2 text-xs font-medium text-[#8d4f34] ring-1 ring-[#d98d69]/30 transition hover:bg-[#fff1ea]"
                                      onClick={() => clearSplitAdjustment(row)}
                                      type="button"
                                    >
                                      Clear split
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="rounded-[1.25rem] bg-white/85 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink/45">Analytics</p>
                                <div className="mt-3">
                                  <button
                                    className={clsx(
                                      "rounded-full px-3 py-2 text-xs font-medium transition",
                                      isExcluded
                                        ? "bg-[#fff1ea] text-[#8d4f34] ring-1 ring-[#d98d69]/30"
                                        : "bg-ink text-white"
                                    )}
                                    onClick={() => toggleReimbursement(row)}
                                    type="button"
                                  >
                                    {isExcluded ? "Excluded" : "Count normally"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr className="border-t border-ink/5">
                  <td className="px-4 py-10 text-center text-ink/60" colSpan={7}>
                    {rows.length > 0
                      ? "No transactions found for the selected month. Try another year or month."
                      : "No parsed transactions yet. Upload a statement from the dashboard to populate this table."}
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
