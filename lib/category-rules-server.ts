import { promises as fs } from "fs";
import path from "path";
import { normalizeDescriptionKey } from "@/lib/category-utils";
import type { CategoryRuleMap } from "@/lib/category-utils";

const RULES_FILE = path.join(process.cwd(), "lib", "category-rules.ts");

function serializeRules(rules: CategoryRuleMap) {
  const entries = Object.entries(rules).sort(([a], [b]) => a.localeCompare(b));
  const body =
    entries.length === 0
      ? ""
      : `${entries.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join("\n")}\n`;

  return `export const BUILTIN_CATEGORY_RULES: Record<string, string> = {
  bus: "Transport",
  mrt: "Transport",
  grab: "Transport",
  ntuc: "Groceries",
  fairprice: "Groceries",
  giant: "Groceries",
  "cold storage": "Groceries",
  "sheng siong": "Groceries",
  market: "Groceries",
  supermarket: "Groceries",
  koufu: "Food",
  "burger king": "Food",
  shihlin: "Food",
  mala: "Food",
  "soup spoon": "Food",
  "don don donki": "Food",
  chicha: "Food",
  "7-eleven": "Food",
  bakery: "Food",
  "chicken rice": "Food",
  ijooz: "Food",
  interest: "Interest",
  shopee: "Shopping",
  popular: "Shopping",
  usmobile: "Bills",
};

export const USER_CATEGORY_RULES: Record<string, string> = {
${body}};\n`;
}

export async function readUserCategoryRules(): Promise<CategoryRuleMap> {
  const source = await fs.readFile(RULES_FILE, "utf8");
  const match = source.match(/export const USER_CATEGORY_RULES: Record<string, string> = \{([\s\S]*?)\};/);

  if (!match) {
    return {};
  }

  const objectLiteral = `{${match[1]}}`;
  return Function(`"use strict"; return (${objectLiteral});`)() as CategoryRuleMap;
}

export async function upsertUserCategoryRule(description: string, category: string) {
  const normalized = normalizeDescriptionKey(description);
  const current = await readUserCategoryRules();
  current[normalized] = category;
  await fs.writeFile(RULES_FILE, serializeRules(current), "utf8");
  return current;
}
