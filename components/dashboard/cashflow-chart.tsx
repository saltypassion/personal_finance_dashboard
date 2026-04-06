"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSnapshot } from "@/lib/dashboard-data";

export function CashflowChart({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  if (!snapshot || snapshot.monthlyTrend.length === 0) {
    return (
      <section className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-white shadow-card">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-white/60">Trend</p>
          <h2 className="mt-2 font-display text-3xl">Income vs expenses</h2>
        </div>
        <div className="flex h-80 items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/5 px-8 text-center">
          <div>
            <p className="font-display text-3xl">No cash flow data yet</p>
            <p className="mt-3 max-w-md text-sm text-white/70">
              Upload a statement and we&apos;ll plot the inflows and outflows from its activity summary here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-white shadow-card">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-white/60">Trend</p>
        <h2 className="mt-2 font-display text-3xl">Income vs expenses</h2>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={snapshot.monthlyTrend}>
            <defs>
              <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#7dd3b0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#7dd3b0" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#f1b183" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f1b183" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#33554d" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#d8e5df" />
            <YAxis tickLine={false} axisLine={false} stroke="#d8e5df" tickFormatter={(value) => `$${value}`} />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Area type="monotone" dataKey="income" stroke="#7dd3b0" fill="url(#incomeFill)" strokeWidth={3} />
            <Area type="monotone" dataKey="expenses" stroke="#f1b183" fill="url(#expenseFill)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
