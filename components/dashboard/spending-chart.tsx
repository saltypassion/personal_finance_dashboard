"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardSnapshot } from "@/lib/dashboard-data";

const COLORS = ["#137c63", "#1d9a7c", "#7dd3b0", "#f1b183", "#d98d69", "#b86f4c"];

type SpendingView = "bars" | "share" | "monthly";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function SpendingChart({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const [view, setView] = useState<SpendingView>("bars");
  const [selectedMonthKey, setSelectedMonthKey] = useState("");

  const monthlyOptions = useMemo(() => snapshot?.categorySpendByMonth ?? [], [snapshot]);
  const selectedMonth =
    monthlyOptions.find((month) => month.key === selectedMonthKey) ??
    monthlyOptions.at(-1) ??
    null;

  useEffect(() => {
    if (!selectedMonthKey && monthlyOptions.length > 0) {
      setSelectedMonthKey(monthlyOptions.at(-1)?.key ?? "");
    }
  }, [monthlyOptions, selectedMonthKey]);

  if (!snapshot || snapshot.categorySpend.length === 0) {
    return (
      <section className="rounded-[2rem] border border-ink/10 bg-panel/85 p-6 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Category Pulse</p>
            <h2 className="mt-2 font-display text-3xl">Where your money went</h2>
          </div>
        </div>
        <div className="flex h-80 items-center justify-center rounded-[1.5rem] border border-ink/10 bg-white/60 px-8 text-center">
          <div>
            <p className="font-display text-3xl">No category totals yet</p>
            <p className="mt-3 max-w-md text-sm text-ink/65">
              Upload a statement and we&apos;ll turn your outgoing transactions into category views here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const topCategory = snapshot.categorySpend[0];
  const monthTotals = selectedMonth?.totals ?? [];
  const monthTopCategory = monthTotals[0];
  const totalMonthSpend = monthTotals.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-panel/85 p-6 shadow-card">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-ink/55">Category Pulse</p>
          <h2 className="mt-2 font-display text-3xl">Where your money went</h2>
          <p className="mt-2 text-sm text-ink/65">
            Switch views to see category leaders, spending share, or a single month&apos;s breakdown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "bars", label: "Top categories" },
            { key: "share", label: "Share view" },
            { key: "monthly", label: "Month breakdown" }
          ].map((option) => (
            <button
              key={option.key}
              className={
                view === option.key
                  ? "rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-ink/15 transition hover:bg-sand/30"
              }
              onClick={() => setView(option.key as SpendingView)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.5rem] bg-sand/45 p-4 text-sm text-ink/70">
          <p className="font-medium text-ink">Top overall category</p>
          <p className="mt-2 font-display text-2xl">{topCategory.category}</p>
          <p className="mt-1">{formatCurrency(topCategory.amount)} spent across all loaded months.</p>
        </div>
        {selectedMonth ? (
          <div className="rounded-[1.5rem] bg-sand/45 p-4 text-sm text-ink/70">
            <p className="font-medium text-ink">{selectedMonth.label}</p>
            <p className="mt-2 font-display text-2xl">{monthTopCategory?.category ?? "No spend"}</p>
            <p className="mt-1">
              {monthTopCategory
                ? `${formatCurrency(monthTopCategory.amount)} led the month.`
                : "No outgoing spend for this month yet."}
            </p>
          </div>
        ) : null}
      </div>

      {view === "bars" ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.categorySpend}>
              <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#d9cbb9" />
              <XAxis dataKey="category" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), "Spend"]} />
              <Bar dataKey="amount" radius={[12, 12, 0, 0]}>
                {snapshot.categorySpend.map((entry, index) => (
                  <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {view === "share" ? (
        <div className="space-y-6">
          <div className="h-80 min-w-0 rounded-[1.5rem] bg-white/65 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={snapshot.categorySpend}
                  dataKey="amount"
                  innerRadius="42%"
                  outerRadius="68%"
                  paddingAngle={2}
                >
                  {snapshot.categorySpend.map((entry, index) => (
                    <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, item) => [
                    formatCurrency(value),
                    item?.payload?.category ?? "Category"
                  ]}
                  separator=": "
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-3">
            {snapshot.categorySpend.map((item, index) => {
              const totalSpend = snapshot.categorySpend.reduce((sum, row) => sum + row.amount, 0);
              const share = totalSpend > 0 ? Math.round((item.amount / totalSpend) * 100) : 0;
              return (
                <div key={item.category} className="rounded-[1.25rem] bg-white/75 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <p className="font-medium text-ink">{item.category}</p>
                    </div>
                    <p className="text-sm text-ink/70">{share}%</p>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">{formatCurrency(item.amount)}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "monthly" ? (
        <div>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Choose month</p>
              <p className="text-sm text-ink/65">See how category spending changed from month to month.</p>
            </div>
            <select
              className="rounded-full border border-ink/15 bg-white px-4 py-3 text-sm text-ink"
              onChange={(event) => setSelectedMonthKey(event.target.value)}
              value={selectedMonth?.key ?? ""}
            >
              {monthlyOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthTotals} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="4 8" horizontal={false} stroke="#d9cbb9" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={96} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), selectedMonth?.label ?? "Spend"]} />
                  <Bar dataKey="amount" radius={[0, 12, 12, 0]}>
                    {monthTotals.map((entry, index) => (
                      <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="rounded-[1.25rem] bg-sand/45 p-4 text-sm text-ink/70">
                <p className="font-medium text-ink">Month total</p>
                <p className="mt-2 font-display text-2xl">{formatCurrency(totalMonthSpend)}</p>
                <p className="mt-1">{selectedMonth?.label ?? "Selected month"} outgoing spend.</p>
              </div>
              {monthTotals.map((item) => {
                const share = totalMonthSpend > 0 ? Math.round((item.amount / totalMonthSpend) * 100) : 0;
                return (
                  <div key={item.category} className="rounded-[1.25rem] bg-white/75 p-4 text-sm text-ink/70">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-ink">{item.category}</p>
                      <p>{formatCurrency(item.amount)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand/70">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/45">{share}% of month spend</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
