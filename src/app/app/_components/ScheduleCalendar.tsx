"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/quote-defaults";

/**
 * Dashboard month calendar of scheduled jobs.
 *
 * Buckets `jobs` by their `date` (YYYY-MM-DD), renders a Monday-first month
 * grid with a dot on any day that has work, lets the tradie page across
 * months, and shows the selected day's jobs beneath the grid. `todayISO`
 * comes from the server so SSR and the client agree on the highlighted /
 * default-selected cell (no hydration drift).
 */
export type CalendarJob = {
  id: string;
  date: string;
  clientName: string;
  jobSummary: string;
  total: number;
  currency: string;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function key(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m, 1));
}
function longDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function ScheduleCalendar({
  jobs,
  todayISO,
}: {
  jobs: CalendarJob[];
  todayISO: string;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarJob[]>();
    for (const j of jobs) {
      const k = (j.date ?? "").slice(0, 10);
      if (!k) continue;
      const arr = map.get(k);
      if (arr) arr.push(j);
      else map.set(k, [j]);
    }
    return map;
  }, [jobs]);

  const [ty, tm] = useMemo(() => {
    const [y, m] = todayISO.split("-").map(Number);
    return [y, (m || 1) - 1] as const;
  }, [todayISO]);

  const [view, setView] = useState<{ y: number; m: number }>({ y: ty, m: tm });
  const [selected, setSelected] = useState<string>(todayISO);

  const { cells, year, month } = useMemo(() => {
    const y = view.y;
    const m = view.m;
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const list: Array<{ day: number; dateKey: string } | null> = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ day: d, dateKey: key(y, m, d) });
    }
    return { cells: list, year: y, month: m };
  }, [view]);

  const selectedJobs = byDay.get(selected) ?? [];

  function step(delta: number) {
    setView((v) => {
      const next = v.m + delta;
      if (next < 0) return { y: v.y - 1, m: 11 };
      if (next > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m: next };
    });
  }

  return (
    <section
      data-testid="dashboard-calendar"
      aria-label="Schedule"
      className="t2q-card-pro mb-7 p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <p className="t2q-section-label-pro">{"// schedule"}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => step(-1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-ink-200 hover:border-brand/50 hover:text-brand"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold text-white">
            {monthLabel(year, month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => step(1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-ink-200 hover:border-brand/50 hover:text-brand"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-500"
          >
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`b${i}`} aria-hidden="true" />;
          const has = byDay.has(c.dateKey);
          const isToday = c.dateKey === todayISO;
          const isSel = c.dateKey === selected;
          return (
            <button
              key={c.dateKey}
              type="button"
              onClick={() => setSelected(c.dateKey)}
              aria-label={`${c.day}${has ? " — has jobs" : ""}`}
              aria-pressed={isSel}
              data-testid={`cal-day-${c.dateKey}`}
              className={[
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors",
                isSel
                  ? "bg-brand text-ink-900"
                  : isToday
                    ? "border border-brand/50 text-white"
                    : "text-ink-200 hover:bg-white/[0.06]",
              ].join(" ")}
            >
              {c.day}
              {has ? (
                <span
                  aria-hidden="true"
                  className={[
                    "absolute bottom-1 h-1 w-1 rounded-full",
                    isSel ? "bg-ink-900" : "bg-brand",
                  ].join(" ")}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          {longDate(selected)}
        </p>
        {selectedJobs.length === 0 ? (
          <p
            data-testid="calendar-day-empty"
            className="mt-2 text-sm text-ink-400"
          >
            No jobs scheduled. Accept a quote, then set a job date to add one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedJobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/app/quotes/preview/${j.id}`}
                  prefetch
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-brand/40 hover:bg-brand/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{j.clientName}</p>
                    {j.jobSummary ? (
                      <p className="mt-0.5 truncate text-xs text-ink-400">
                        {j.jobSummary}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-ink-200">
                    {formatCurrency(j.total, j.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
