import type { DashboardSnapshot } from "@/lib/dashboard-data";

export function SummaryCards({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const cards =
    snapshot?.cards ?? [
      { label: "Closing Balance", value: "No data", change: "Upload statements to calculate this." },
      { label: "Monthly Spend", value: "No data", change: "Spend totals will appear after imports." },
      { label: "Savings Rate", value: "No data", change: "Income and expenses are not loaded yet." }
    ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-[1.75rem] border border-ink/10 bg-panel/85 p-5 shadow-card backdrop-blur"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-ink/55">{card.label}</p>
          <p className="mt-4 font-display text-4xl">{card.value}</p>
          <p className="mt-3 text-sm text-ink/65">{card.change}</p>
        </article>
      ))}
    </section>
  );
}
