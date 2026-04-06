import { mergeParseResponses } from "@/lib/dashboard-data";
import {
  CATEGORY_RULES_STORAGE_KEY,
  type CategoryRuleMap,
  type OneOffCategoryOverrideMap
} from "@/lib/category-utils";
import {
  LAST_PARSED_TRANSACTIONS_KEY,
  ONE_OFF_CATEGORY_OVERRIDES_KEY,
  PARSED_STATEMENT_HISTORY_KEY,
  type ParseResponse,
  type StoredParsedStatement
} from "@/lib/types";

export function readStorageJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function loadCombinedLocalParsed(): ParseResponse | null {
  const parsedHistory = readStorageJson<StoredParsedStatement[]>(PARSED_STATEMENT_HISTORY_KEY) ?? [];
  const lastParsed = readStorageJson<ParseResponse>(LAST_PARSED_TRANSACTIONS_KEY);

  return mergeParseResponses(parsedHistory) ?? lastParsed;
}

export async function loadCategoryRules(): Promise<CategoryRuleMap> {
  const storedRules = readStorageJson<CategoryRuleMap>(CATEGORY_RULES_STORAGE_KEY);

  if (storedRules) {
    return storedRules;
  }

  try {
    const response = await fetch("/api/category-rules", { cache: "no-store" });
    const json = (await response.json()) as { rules: CategoryRuleMap };
    localStorage.setItem(CATEGORY_RULES_STORAGE_KEY, JSON.stringify(json.rules));
    return json.rules;
  } catch {
    return {};
  }
}

export function loadOneOffOverrides(): OneOffCategoryOverrideMap {
  return readStorageJson<OneOffCategoryOverrideMap>(ONE_OFF_CATEGORY_OVERRIDES_KEY) ?? {};
}
