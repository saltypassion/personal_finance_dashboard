"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_RULES_STORAGE_KEY } from "@/lib/category-utils";
import {
  IGNORED_TEACH_TRANSACTIONS_KEY,
  LAST_PARSED_TRANSACTIONS_KEY,
  ONE_OFF_CATEGORY_OVERRIDES_KEY,
  PARSED_STATEMENT_HISTORY_KEY,
  REIMBURSEMENT_EXCLUSIONS_KEY,
  SPLIT_ADJUSTMENTS_KEY,
  UPLOADED_STATEMENTS_KEY
} from "@/lib/types";

const RESET_KEYS = [
  LAST_PARSED_TRANSACTIONS_KEY,
  PARSED_STATEMENT_HISTORY_KEY,
  CATEGORY_RULES_STORAGE_KEY,
  ONE_OFF_CATEGORY_OVERRIDES_KEY,
  REIMBURSEMENT_EXCLUSIONS_KEY,
  SPLIT_ADJUSTMENTS_KEY,
  IGNORED_TEACH_TRANSACTIONS_KEY,
  UPLOADED_STATEMENTS_KEY
];

export default function ResetPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    for (const key of RESET_KEYS) {
      localStorage.removeItem(key);
    }

    window.dispatchEvent(new Event("uploaded-statements-updated"));
    window.dispatchEvent(new Event("category-rules-updated"));
    setDone(true);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
      <section className="w-full rounded-[2rem] border border-ink/10 bg-panel/90 p-8 shadow-card">
        <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Reset</p>
        <h1 className="mt-2 font-display text-4xl">App data cleared</h1>
        <p className="mt-4 text-sm text-ink/70 md:text-base">
          {done
            ? "Your browser-side finance dashboard state has been cleared for this app. You can head back and test from a blank start."
            : "Clearing browser-side dashboard state..."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-ink/15 bg-white/80 px-4 py-2 font-medium text-ink transition hover:bg-white"
            href="/"
          >
            Back to dashboard
          </Link>
          <Link
            className="rounded-full border border-ink/15 bg-white/80 px-4 py-2 font-medium text-ink transition hover:bg-white"
            href="/uploads"
          >
            Check upload history
          </Link>
        </div>
      </section>
    </main>
  );
}
