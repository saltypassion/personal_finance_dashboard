"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  loadCategoryRules,
  loadCombinedLocalParsed,
  loadOneOffOverrides
} from "@/lib/client-finance-state";
import {
  CATEGORY_OPTIONS,
  resolveCategory,
  transactionOverrideKey,
  type CategoryName,
  type CategoryRuleMap,
  type OneOffCategoryOverrideMap
} from "@/lib/category-utils";
import { type ParseResponse, type ParsedTransaction } from "@/lib/types";

type CategorizedTransaction = ParsedTransaction & {
  resolvedCategory: string;
  source: string;
};

type MonthOption = {
  key: string;
  label: string;
};

function parseTransactions(
  parsed: ParseResponse,
  rules: CategoryRuleMap,
  oneOffOverrides: OneOffCategoryOverrideMap
): CategorizedTransaction[] {
  return parsed.transactions.map((transaction) => ({
    ...transaction,
    resolvedCategory:
      oneOffOverrides[transactionOverrideKey(transaction)] ??
      transaction.category ??
      resolveCategory(transaction.description, rules),
    source: parsed.institution
  }));
}

export function CategoryTransactionsClient() {
  const [transactions, setTransactions] = useState<CategorizedTransaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryName>("Food");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [meta, setMeta] = useState<{ title: string; subtitle: string }>({
    title: "No saved transactions yet",
    subtitle: "Upload a statement first and this page will let you browse transactions by category."
  });

  useEffect(() => {
    async function hydrate() {
      const rules = await loadCategoryRules();
      const oneOffOverrides = loadOneOffOverrides();

      try {
        const response = await fetch("/api/dashboard-data", { cache: "no-store" });
        const json = (await response.json()) as { parsed: ParseResponse | null };

        if (json.parsed) {
          setTransactions(parseTransactions(json.parsed, rules, oneOffOverrides));
          setMeta({
            title: `Browsing categories from ${json.parsed.institution}`,
            subtitle: "Choose a category to see every matching transaction across your saved statements."
          });
          return;
        }
      } catch {
        // Fall back to local parsed data below.
      }

      const parsed = loadCombinedLocalParsed();
      if (parsed) {
        setTransactions(parseTransactions(parsed, rules, oneOffOverrides));
        setMeta({
          title: `Browsing categories from ${parsed.institution}`,
          subtitle: "Choose a category to see every matching transaction across your saved statements."
        });
      }
    }

    void hydrate();
  }, []);

  const monthOptions = useMemo<MonthOption[]>(
    () => [
      { key: "all", label: "All months" },
      ...[...new Set(transactions.map((transaction) => transaction.date.slice(0, 7)))]
        .sort((a, b) => b.localeCompare(a))
        .map((key) => ({
          key,
          label: new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(
            new Date(`${key}-01T00:00:00`)
          )
        }))
    ],
    [transactions]
  );

  const filteredTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.resolvedCategory === selectedCategory)
        .filter((transaction) => selectedMonth === "all" || transaction.date.startsWith(selectedMonth))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [selectedCategory, selectedMonth, transactions]
  );

  const categoryTotal = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-[2rem] border border-ink/10 bg-panel/85 p-8 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Category Explorer</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">Transactions by category</h1>
            <p className="mt-3 max-w-3xl text-sm text-ink/70 md:text-base">{meta.subtitle}</p>
          </div>
          <div className="flex gap-3">
            <Link
              className="rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-sm font-medium text-ink transition hover:bg-white"
              href="/transactions"
            >
              View raw transactions
            </Link>
            <Link
              className="rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-sm font-medium text-ink transition hover:bg-white"
              href="/"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-[1.5rem] bg-panel/90 p-4 lg:grid-cols-[1fr_1fr_1.2fr]">
          <label className="text-sm text-ink/70">
            <span className="mb-2 block font-medium text-ink">Category</span>
            <select
              className="w-full rounded-full border border-ink/15 bg-white px-4 py-3"
              onChange={(event) => setSelectedCategory(event.target.value as CategoryName)}
              value={selectedCategory}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
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
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-[1.25rem] bg-sand/45 p-4 text-sm text-ink/70">
            <p className="font-medium text-ink">{selectedCategory}</p>
            <p className="mt-2 font-display text-2xl">
              {new Intl.NumberFormat("en-SG", {
                style: "currency",
                currency: "SGD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }).format(categoryTotal)}
            </p>
            <p className="mt-1">
              {filteredTransactions.length} matching transaction{filteredTransactions.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
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
              </tr>
            </thead>
            <tbody className="bg-white/75">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction, index) => (
                  <tr key={`${transaction.date}-${transaction.description}-${index}`} className="border-t border-ink/5">
                    <td className="px-4 py-4 whitespace-nowrap">{transaction.date}</td>
                    <td className="min-w-[22rem] px-4 py-4">{transaction.description}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-ink/65">{transaction.source}</td>
                    <td
                      className={clsx(
                        "px-4 py-4 whitespace-nowrap text-right font-medium",
                        transaction.amount < 0 ? "text-[#a94d26]" : "text-accent"
                      )}
                    >
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{transaction.resolvedCategory}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-ink/5">
                  <td className="px-4 py-10 text-center text-ink/60" colSpan={5}>
                    No transactions match this category and month yet.
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
