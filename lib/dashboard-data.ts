import type {
  CategoryTotal,
  MonthlyTrendPoint,
  ParseResponse,
  ParsedTransaction,
  StatementSummary,
  StoredParsedStatement
} from "@/lib/types";
import {
  mergeCategoryRules,
  resolveCategory,
  transactionOverrideKey,
  type CategoryRuleMap,
  type OneOffCategoryOverrideMap,
  type TransactionExclusionMap,
  type TransactionSplitAdjustmentMap
} from "@/lib/category-utils";

export type DashboardCard = {
  label: string;
  value: string;
  change: string;
};

export type CategorySpendMonth = {
  key: string;
  label: string;
  totals: CategoryTotal[];
};

export type DashboardSnapshot = {
  cards: DashboardCard[];
  focusTitle: string;
  focusDetail: string;
  categorySpend: CategoryTotal[];
  categorySpendByMonth: CategorySpendMonth[];
  monthlyTrend: MonthlyTrendPoint[];
  recentTransactions: ParsedTransaction[];
  summary: StatementSummary | null;
  transactionCount: number;
  insights: string[];
};

function transactionIdentity(transaction: ParsedTransaction) {
  return [
    transaction.date,
    transaction.description,
    transaction.amount.toFixed(2),
    transaction.currency
  ].join("|");
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return "No data";
  }

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function byDateAscending(a: ParsedTransaction, b: ParsedTransaction) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

function deriveCategorySpend(transactions: ParsedTransaction[], rules: CategoryRuleMap): CategoryTotal[] {
  const spendByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const category = transaction.category ?? resolveCategory(transaction.description, rules);
    spendByCategory.set(category, (spendByCategory.get(category) ?? 0) + Math.abs(transaction.amount));
  }

  return [...spendByCategory.entries()]
    .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

function deriveMonthlyTrend(transactions: ParsedTransaction[]): MonthlyTrendPoint[] {
  if (transactions.length === 0) {
    return [];
  }

  const monthlyBuckets = new Map<string, { income: number; expenses: number; date: Date }>();

  for (const transaction of transactions) {
    const date = new Date(`${transaction.date}T00:00:00`);
    const bucketKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyBuckets.get(bucketKey) ?? {
      income: 0,
      expenses: 0,
      date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    };

    if (transaction.amount >= 0) {
      existing.income += transaction.amount;
    } else {
      existing.expenses += Math.abs(transaction.amount);
    }

    monthlyBuckets.set(bucketKey, existing);
  }

  return [...monthlyBuckets.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => ({
      month: new Intl.DateTimeFormat("en-SG", { month: "short", year: "2-digit" }).format(bucket.date),
      income: Number(bucket.income.toFixed(2)),
      expenses: Number(bucket.expenses.toFixed(2))
    }));
}

function deriveCategorySpendByMonth(
  transactions: ParsedTransaction[],
  rules: CategoryRuleMap
): CategorySpendMonth[] {
  const monthlyBuckets = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const date = new Date(`${transaction.date}T00:00:00`);
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const category = transaction.category ?? resolveCategory(transaction.description, rules);
    const monthBucket = monthlyBuckets.get(monthKey) ?? new Map<string, number>();
    monthBucket.set(category, (monthBucket.get(category) ?? 0) + Math.abs(transaction.amount));
    monthlyBuckets.set(monthKey, monthBucket);
  }

  return [...monthlyBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, totals]) => ({
      key,
      label: new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(
        new Date(`${key}-01T00:00:00`)
      ),
      totals: [...totals.entries()]
        .map(([category, amount]) => ({
          category,
          amount: Number(amount.toFixed(2))
        }))
        .sort((a, b) => b.amount - a.amount)
    }));
}

export function mergeParseResponses(statements: StoredParsedStatement[]): ParseResponse | null {
  if (statements.length === 0) {
    return null;
  }

  const sortedStatements = [...statements].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  const latestStatement = sortedStatements.at(-1);

  if (!latestStatement) {
    return null;
  }

  const transactionsById = new Map<string, ParsedTransaction>();

  for (const statement of sortedStatements) {
    for (const transaction of statement.parsed.transactions) {
      const key = transactionIdentity(transaction);
      if (!transactionsById.has(key)) {
        transactionsById.set(key, transaction);
      }
    }
  }

  return {
    institution: latestStatement.parsed.institution,
    account_name: latestStatement.parsed.account_name,
    transactions: [...transactionsById.values()].sort(byDateAscending),
    summary: latestStatement.parsed.summary ?? null,
    insights: [...new Set(sortedStatements.flatMap((statement) => statement.parsed.insights))],
    warnings: [...new Set(sortedStatements.flatMap((statement) => statement.parsed.warnings))],
    statementImportId: latestStatement.parsed.statementImportId
  };
}

export function buildDashboardSnapshot(
  parsed: ParseResponse,
  runtimeRules: CategoryRuleMap = {},
  oneOffOverrides: OneOffCategoryOverrideMap = {},
  reimbursementExclusions: TransactionExclusionMap = {},
  splitAdjustments: TransactionSplitAdjustmentMap = {},
  statementCount = 1
): DashboardSnapshot {
  const rules = mergeCategoryRules(runtimeRules);
  const transactions = [...parsed.transactions]
    .sort(byDateAscending)
    .map((transaction) => {
      const override = oneOffOverrides[transactionOverrideKey(transaction)];
      return {
        ...transaction,
        category: override ?? transaction.category ?? resolveCategory(transaction.description, rules)
      };
    });
  const analyticsTransactions = transactions
    .filter((transaction) => !reimbursementExclusions[transactionOverrideKey(transaction)])
    .map((transaction) => {
      const key = transactionOverrideKey(transaction);
      const adjustedAmount = splitAdjustments[key];

      if (adjustedAmount == null) {
        return transaction;
      }

      return {
        ...transaction,
        amount: adjustedAmount
      };
    });
  const summary = parsed.summary ?? null;
  const outgoing =
    analyticsTransactions.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
  const incoming =
    analyticsTransactions.filter((txn) => txn.amount > 0).reduce((sum, txn) => sum + txn.amount, 0);
  const opening = summary?.opening_balance ?? null;
  const closing = summary?.closing_balance ?? transactions.at(-1)?.balance ?? null;
  const savingsRate = incoming > 0 ? ((incoming - outgoing) / incoming) * 100 : null;
  const netFlow = incoming - outgoing;
  const biggestSpend = analyticsTransactions.filter((txn) => txn.amount < 0).sort((a, b) => a.amount - b.amount)[0] ?? null;

  return {
    cards: [
      {
        label: "Closing Balance",
        value: formatCurrency(closing),
        change: opening != null && closing != null ? `${closing >= opening ? "+" : ""}${formatCurrency(closing - opening)} vs opening balance` : "Derived from uploaded statement"
      },
      {
        label: "Monthly Spend",
        value: formatCurrency(outgoing),
        change: biggestSpend ? `Largest outgoing: ${toTitleCase(biggestSpend.description)} (${formatCurrency(Math.abs(biggestSpend.amount))})` : "No outgoing transactions found"
      },
      {
        label: "Savings Rate",
        value: savingsRate == null ? "No data" : `${Math.round(savingsRate)}%`,
        change: incoming > 0 ? `${formatCurrency(netFlow)} net cash flow this statement` : "Income not detected yet"
      }
    ],
    focusTitle:
      netFlow >= 0
        ? `${formatCurrency(netFlow)} left after inflows`
        : `${formatCurrency(Math.abs(netFlow))} more spent than received`,
    focusDetail:
      summary?.interest != null
        ? `Interest earned: ${formatCurrency(summary.interest)}. Closing balance: ${formatCurrency(closing)}.`
        : statementCount > 1
          ? `Built from ${statementCount} uploaded statements combined.`
          : "Based on the latest parsed statement summary.",
    categorySpend: deriveCategorySpend(analyticsTransactions, rules),
    categorySpendByMonth: deriveCategorySpendByMonth(analyticsTransactions, rules),
    monthlyTrend: deriveMonthlyTrend(analyticsTransactions),
    recentTransactions: [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    summary,
    transactionCount: analyticsTransactions.length,
    insights: parsed.insights
  };
}
