import { BUILTIN_CATEGORY_RULES, USER_CATEGORY_RULES } from "@/lib/category-rules";

export const CATEGORY_RULES_STORAGE_KEY = "finance-dashboard-category-rules";

export const CATEGORY_OPTIONS = [
  "Food",
  "Groceries",
  "Transport",
  "Shopping",
  "Transfer",
  "Income",
  "Investment",
  "Interest",
  "Entertainment",
  "Travel",
  "Bills",
  "General"
] as const;

export type CategoryName = (typeof CATEGORY_OPTIONS)[number];
export type CategoryRuleMap = Record<string, string>;
export type OneOffCategoryOverrideMap = Record<string, string>;
export type TransactionExclusionMap = Record<string, boolean>;
export type TransactionSplitAdjustmentMap = Record<string, number>;

export function normalizeDescriptionKey(description: string) {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCategory(
  description: string,
  runtimeRules: CategoryRuleMap = USER_CATEGORY_RULES
) {
  const normalized = normalizeDescriptionKey(description);

  for (const [pattern, category] of Object.entries(runtimeRules)) {
    if (normalized.includes(pattern)) {
      return category;
    }
  }

  for (const [pattern, category] of Object.entries(BUILTIN_CATEGORY_RULES)) {
    if (normalized.includes(pattern)) {
      return category;
    }
  }

  return "General";
}

export function mergeCategoryRules(runtimeRules: CategoryRuleMap = {}) {
  return {
    ...USER_CATEGORY_RULES,
    ...runtimeRules
  };
}

export function transactionOverrideKey(input: {
  date: string;
  description: string;
  amount: number;
}) {
  return `${input.date}__${normalizeDescriptionKey(input.description)}__${input.amount.toFixed(2)}`;
}
