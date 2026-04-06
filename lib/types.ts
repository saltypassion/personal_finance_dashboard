export type CategoryTotal = {
  category: string;
  amount: number;
};

export type MonthlyTrendPoint = {
  month: string;
  income: number;
  expenses: number;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  accountName: string;
  merchant?: string | null;
};

export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  balance?: number | null;
  currency: string;
  category?: string | null;
};

export type StatementSummary = {
  opening_balance?: number | null;
  total_incoming?: number | null;
  total_outgoing?: number | null;
  interest?: number | null;
  closing_balance?: number | null;
};

export type ParseResponse = {
  institution: string;
  account_name?: string | null;
  transactions: ParsedTransaction[];
  summary?: StatementSummary | null;
  insights: string[];
  warnings: string[];
  statementImportId?: string;
};

export type StoredParsedStatement = {
  id: string;
  filename: string;
  uploadedAt: string;
  parsed: ParseResponse;
};

export type UploadedStatementRecord = {
  id: string;
  filename: string;
  uploadedAt: string;
  transactionCount: number;
  institution: string;
  statementStartDate?: string | null;
  statementEndDate?: string | null;
};

export const LAST_PARSED_TRANSACTIONS_KEY = "finance-dashboard-last-parse";
export const PARSED_STATEMENT_HISTORY_KEY = "finance-dashboard-parsed-statement-history";
export const ONE_OFF_CATEGORY_OVERRIDES_KEY = "finance-dashboard-one-off-category-overrides";
export const UPLOADED_STATEMENTS_KEY = "finance-dashboard-uploaded-statements";
export const REIMBURSEMENT_EXCLUSIONS_KEY = "finance-dashboard-reimbursement-exclusions";
export const SPLIT_ADJUSTMENTS_KEY = "finance-dashboard-split-adjustments";
export const IGNORED_TEACH_TRANSACTIONS_KEY = "finance-dashboard-ignored-teach-transactions";
