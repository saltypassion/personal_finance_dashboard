"use client";

import { useEffect, useState } from "react";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { UploadCard } from "@/components/dashboard/upload-card";
import { Header } from "@/components/shell/header";
import { buildDashboardSnapshot, mergeParseResponses, type DashboardSnapshot } from "@/lib/dashboard-data";
import {
  CATEGORY_RULES_STORAGE_KEY,
  type CategoryRuleMap,
  type OneOffCategoryOverrideMap,
  type TransactionExclusionMap,
  type TransactionSplitAdjustmentMap
} from "@/lib/category-utils";
import {
  LAST_PARSED_TRANSACTIONS_KEY,
  PARSED_STATEMENT_HISTORY_KEY,
  ONE_OFF_CATEGORY_OVERRIDES_KEY,
  REIMBURSEMENT_EXCLUSIONS_KEY,
  SPLIT_ADJUSTMENTS_KEY,
  type ParseResponse,
  type StoredParsedStatement
} from "@/lib/types";

export function DashboardClient() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    async function hydrate() {
      const storedHistory = localStorage.getItem(PARSED_STATEMENT_HISTORY_KEY);
      const raw = localStorage.getItem(LAST_PARSED_TRANSACTIONS_KEY);
      try {
        const parsedHistory = storedHistory ? (JSON.parse(storedHistory) as StoredParsedStatement[]) : [];
        const localParsed =
          mergeParseResponses(parsedHistory) ??
          (raw ? (JSON.parse(raw) as ParseResponse) : null);
        let persistedParsed: ParseResponse | null = null;
        let persistedStatementCount = 0;

        try {
          const response = await fetch("/api/dashboard-data", { cache: "no-store" });
          const json = (await response.json()) as { parsed: ParseResponse | null; statementCount: number };
          persistedParsed = json.parsed;
          persistedStatementCount = json.statementCount;
        } catch {
          persistedParsed = null;
          persistedStatementCount = 0;
        }

        const parsed =
          persistedParsed == null
            ? localParsed
            : {
                institution: localParsed?.institution ?? persistedParsed.institution,
                account_name: localParsed?.account_name ?? persistedParsed.account_name,
                transactions: persistedParsed.transactions,
                summary: localParsed?.summary ?? null,
                insights: localParsed?.insights ?? [],
                warnings: [...new Set([...(localParsed?.warnings ?? []), ...(persistedParsed.warnings ?? [])])],
                statementImportId: localParsed?.statementImportId ?? persistedParsed.statementImportId
              };
        if (!parsed) return;
        const storedRules = localStorage.getItem(CATEGORY_RULES_STORAGE_KEY);
        const storedOverrides = localStorage.getItem(ONE_OFF_CATEGORY_OVERRIDES_KEY);
        const storedExclusions = localStorage.getItem(REIMBURSEMENT_EXCLUSIONS_KEY);
        const storedSplitAdjustments = localStorage.getItem(SPLIT_ADJUSTMENTS_KEY);
        let rules: CategoryRuleMap = storedRules ? (JSON.parse(storedRules) as CategoryRuleMap) : {};
        const overrides: OneOffCategoryOverrideMap = storedOverrides
          ? (JSON.parse(storedOverrides) as OneOffCategoryOverrideMap)
          : {};
        const exclusions: TransactionExclusionMap = storedExclusions
          ? (JSON.parse(storedExclusions) as TransactionExclusionMap)
          : {};
        const splitAdjustments: TransactionSplitAdjustmentMap = storedSplitAdjustments
          ? (JSON.parse(storedSplitAdjustments) as TransactionSplitAdjustmentMap)
          : {};

        if (!storedRules) {
          const response = await fetch("/api/category-rules", { cache: "no-store" });
          const json = (await response.json()) as { rules: CategoryRuleMap };
          rules = json.rules;
          localStorage.setItem(CATEGORY_RULES_STORAGE_KEY, JSON.stringify(rules));
        }

        setSnapshot(
          buildDashboardSnapshot(
            parsed,
            rules,
            overrides,
            exclusions,
            splitAdjustments,
            Math.max(parsedHistory.length, persistedStatementCount, parsed ? 1 : 0)
          )
        );
      } catch {
        localStorage.removeItem(PARSED_STATEMENT_HISTORY_KEY);
        localStorage.removeItem(LAST_PARSED_TRANSACTIONS_KEY);
      }
    }

    const rerender = () => {
      void hydrate();
    };

    void hydrate();
    window.addEventListener("category-rules-updated", rerender);
    window.addEventListener("uploaded-statements-updated", rerender);
    window.addEventListener("storage", rerender);

    return () => {
      window.removeEventListener("category-rules-updated", rerender);
      window.removeEventListener("uploaded-statements-updated", rerender);
      window.removeEventListener("storage", rerender);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <Header snapshot={snapshot} />
      <SummaryCards snapshot={snapshot} />
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <CashflowChart snapshot={snapshot} />
        <UploadCard />
      </section>
      <SpendingChart snapshot={snapshot} />
    </main>
  );
}
