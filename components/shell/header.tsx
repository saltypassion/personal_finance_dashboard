import Link from "next/link";
import { Wallet } from "lucide-react";
import type { DashboardSnapshot } from "@/lib/dashboard-data";

const HEADER_LINKS = [
  { href: "/transactions", label: "View Raw Transactions" },
  { href: "/categories", label: "Review Categories" },
  { href: "/category-transactions", label: "Browse Categories" },
  { href: "/uploads", label: "Upload History" }
] as const;

export function Header({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  return (
    <header className="flex flex-col gap-6 rounded-[2rem] border border-ink/10 bg-panel/80 p-8 shadow-card backdrop-blur md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/80 px-3 py-1 text-sm">
          <Wallet className="h-4 w-4 text-accent" />
          Finance OS
        </div>
        <div>
          <p className="font-display text-4xl leading-none md:text-6xl">
            Your money,
            <br />
            with less mystery.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-ink/70 md:text-base">
            Upload bank PDFs, normalize transactions, and spot spending drift before it sneaks up on you.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5 text-sm">
            {HEADER_LINKS.map((link) => (
              <Link
                key={link.href}
                className="rounded-full border border-ink/15 bg-white/85 px-4 py-2 font-medium text-ink transition hover:bg-white"
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[1.5rem] bg-ink p-5 text-white">
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">Focus</p>
        <p className="mt-2 text-2xl font-medium">{snapshot?.focusTitle ?? "No financial snapshot yet"}</p>
        <p className="mt-2 text-sm text-white/75">
          {snapshot?.focusDetail ?? "Import statements to generate a real monthly plan and cash flow summary."}
        </p>
      </div>
    </header>
  );
}
