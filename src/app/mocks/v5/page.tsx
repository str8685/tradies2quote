import Link from "next/link";
import type { Metadata } from "next";
import {
  Plus,
  House,
  ListBullets,
  Receipt,
  MagnifyingGlass,
  Bell,
  CalendarBlank,
  CheckCircle,
  Clock,
  CaretRight,
  ArrowUpRight,
  Eye,
  FileText,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Mock v5 — XERO ACCOUNTING APP
 *
 * Clean light surface (cream paper backdrop, white cards, subtle 1px
 * shadows), compact data-dense lists, clear status pills, brand orange
 * as the primary CTA wherever Xero would use its blue. Sans-serif
 * (Inter) throughout — no decorative serif here, this is meant to read
 * as a calm, professional accounting-app dashboard.
 *
 * `data-theme="light"` activates the light-mode token remapping so the
 * standard ink-* utilities render on cream instead of black — keeps the
 * markup the same as the real app so the rollout is mechanical.
 */
export const metadata: Metadata = { title: "Xero-style — Mock v5" };

const PAPER = "#F5F4EE";
const CARD_BORDER = "#E8E6DD";
const ROW_BORDER = "#F0EFE9";

export default function MockXero() {
  return (
    <div
      data-theme="light"
      className="min-h-[100dvh] text-ink-900"
      style={{ background: PAPER }}
    >
      {/* Top bar — white, sticky, calm. Matches Xero's "always-there" app bar. */}
      <header
        className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-semibold text-white">
              T
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink-900">
              Tradies<span className="text-brand">2</span>Quote
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Search"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border bg-white text-ink-500 hover:text-ink-900 sm:flex"
              style={{ borderColor: CARD_BORDER }}
            >
              <MagnifyingGlass size={16} weight="bold" />
            </button>
            <button
              aria-label="Notifications"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border bg-white text-ink-500 hover:text-ink-900 sm:flex"
              style={{ borderColor: CARD_BORDER }}
            >
              <Bell size={16} weight="bold" />
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600">
              <Plus size={14} weight="bold" />
              <span className="hidden sm:inline">New quote</span>
              <span className="sm:hidden">New</span>
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
              C
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-32 sm:px-6 sm:pt-8">
        {/* Page heading */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Welcome back, Challis
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Tuesday, 2 June 2026 · Bayside Builders
          </p>
        </div>

        {/* KPI cards row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="This month" value="$12,480" sub="+24% vs May" tone="brand" />
          <KpiCard label="Quotes sent" value="7" sub="3 awaiting reply" />
          <KpiCard label="Accepted" value="$8,210" sub="66% conversion" tone="positive" />
          <KpiCard label="Drafts" value="4" sub="2 missing prices" tone="warning" />
        </div>

        {/* Two-column on lg+, stacked below */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Recent quotes — Xero-style table */}
          <section
            className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2"
            style={{ borderColor: CARD_BORDER }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: CARD_BORDER }}
            >
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  Recent quotes
                </h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  Last 7 days · all clients
                </p>
              </div>
              <Link
                href="#"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-700"
              >
                View all
                <ArrowUpRight size={12} weight="bold" />
              </Link>
            </div>
            <ul>
              {QUOTES.map((q, i, arr) => (
                <li
                  key={q.code}
                  className="flex items-center gap-3 px-5 py-3.5"
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? `1px solid ${ROW_BORDER}` : "none",
                  }}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
                    <FileText size={16} weight="regular" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {q.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {q.code} · {q.date}
                    </p>
                  </div>
                  <StatusPill tone={q.tone} />
                  <p className="hidden shrink-0 text-sm font-semibold tabular-nums text-ink-900 sm:block">
                    {q.value}
                  </p>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className="hidden shrink-0 text-ink-400 sm:block"
                  />
                </li>
              ))}
            </ul>
            <div
              className="flex items-center justify-between border-t px-5 py-3"
              style={{ borderColor: CARD_BORDER }}
            >
              <p className="text-xs text-ink-500">7 of 18 quotes</p>
              <Link
                href="#"
                className="text-xs font-semibold text-brand hover:text-brand-700"
              >
                See all quotes →
              </Link>
            </div>
          </section>

          {/* Up next */}
          <section
            className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{ borderColor: CARD_BORDER }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: CARD_BORDER }}
            >
              <div className="flex items-center gap-2">
                <CalendarBlank size={16} weight="bold" className="text-brand" />
                <h2 className="text-base font-semibold text-ink-900">
                  Up next
                </h2>
              </div>
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                3 jobs
              </span>
            </div>
            <ul>
              {UP_NEXT.map((row, i, arr) => (
                <li
                  key={row.date}
                  className="px-5 py-3.5"
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? `1px solid ${ROW_BORDER}` : "none",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Clock
                      size={12}
                      weight="bold"
                      className={row.urgent ? "text-brand" : "text-ink-400"}
                    />
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${row.urgent ? "text-brand" : "text-ink-500"}`}
                    >
                      {row.date}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-ink-900">{row.job}</p>
                </li>
              ))}
            </ul>
            <Link
              href="#"
              className="block border-t px-5 py-3 text-center text-xs font-semibold text-brand hover:text-brand-700"
              style={{ borderColor: CARD_BORDER }}
            >
              Open calendar →
            </Link>
          </section>
        </div>

        {/* Activity */}
        <section
          className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          style={{ borderColor: CARD_BORDER }}
        >
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: CARD_BORDER }}
          >
            <div>
              <h2 className="text-base font-semibold text-ink-900">Activity</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Customer responses + system updates
              </p>
            </div>
            <Link
              href="#"
              className="text-xs font-semibold text-brand hover:text-brand-700"
            >
              View all
            </Link>
          </div>
          <ul>
            {ACTIVITY.map((row, i, arr) => (
              <li
                key={i}
                className="flex items-center gap-3 px-5 py-3.5"
                style={{
                  borderBottom:
                    i < arr.length - 1 ? `1px solid ${ROW_BORDER}` : "none",
                }}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${row.bg}`}
                >
                  {row.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">{row.text}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{row.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/mocks"
            className="text-xs font-semibold text-ink-500 hover:text-brand"
          >
            ← back to mocks
          </Link>
        </div>
      </main>

      {/* Mobile bottom tab nav — Xero-style white bar, hairline, soft shadow */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)] sm:hidden"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom,0)]">
          <TabTile icon={<House size={20} weight="fill" />} label="Home" active />
          <TabTile icon={<ListBullets size={20} />} label="Quotes" />
          <TabTile icon={<Plus size={22} weight="bold" />} label="" primary />
          <TabTile icon={<Receipt size={20} />} label="Invoices" />
          <TabTile
            icon={
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[10px] font-semibold text-white">
                C
              </span>
            }
            label="Me"
          />
        </div>
      </nav>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────

const QUOTES: Array<{
  code: string;
  name: string;
  date: string;
  value: string;
  tone: "draft" | "sent" | "accepted" | "declined";
}> = [
  { code: "Q-2026-CF9F", name: "Kelly Bain", date: "2 Jun", value: "$5,244.00", tone: "draft" },
  { code: "Q-2026-D8C1", name: "Kelly Bain", date: "31 May", value: "$6,957.27", tone: "sent" },
  { code: "Q-2026-70EF", name: "BM O'Hanlon Builders", date: "29 May", value: "$6,039.29", tone: "accepted" },
  { code: "Q-2026-177E", name: "BM O'Hanlon Builders", date: "28 May", value: "$7,480.98", tone: "sent" },
  { code: "Q-2026-AEF2", name: "Kelly Bain", date: "27 May", value: "$3,869.52", tone: "draft" },
];

const UP_NEXT = [
  { date: "Today · 8 am", job: "Kelly Bain deck — start frame", urgent: true },
  { date: "Wed · 7 am", job: "BM O'Hanlon — concrete pour", urgent: false },
  { date: "Fri · 9 am", job: "Site visit & measure", urgent: false },
];

const ACTIVITY = [
  {
    icon: <CheckCircle size={14} weight="fill" className="text-emerald-600" />,
    bg: "bg-emerald-50",
    text: "BM O'Hanlon Builders accepted Q-2026-70EF — $6,039.29",
    time: "Today, 10:14 am",
  },
  {
    icon: <Eye size={14} weight="fill" className="text-blue-600" />,
    bg: "bg-blue-50",
    text: "Kelly Bain viewed Q-2026-AEF2",
    time: "Today, 9:32 am",
  },
  {
    icon: <FileText size={14} weight="fill" className="text-brand" />,
    bg: "bg-brand-50",
    text: "New quote Q-2026-CF9F drafted from voice note",
    time: "Today, 8:45 am",
  },
];

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "positive" | "warning" | "neutral";
}) {
  const valueTone =
    tone === "brand"
      ? "text-brand"
      : tone === "positive"
        ? "text-emerald-700"
        : tone === "warning"
          ? "text-amber-700"
          : "text-ink-900";
  return (
    <div
      className="rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5"
      style={{ borderColor: CARD_BORDER }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${valueTone}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

function StatusPill({
  tone,
}: {
  tone: "draft" | "sent" | "accepted" | "declined";
}) {
  const map = {
    draft: { label: "Draft", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
    sent: { label: "Sent", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    declined: { label: "Declined", cls: "bg-red-50 text-red-700 ring-red-200" },
  } as const;
  const t = map[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${t.cls}`}
    >
      {t.label}
    </span>
  );
}

function TabTile({
  icon,
  label,
  active = false,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <button
        aria-label="New quote"
        className="flex flex-1 items-center justify-center py-2"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white shadow-[0_4px_10px_-2px_rgba(255,95,21,0.45)]">
          {icon}
        </span>
      </button>
    );
  }
  return (
    <button
      className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-medium ${active ? "text-brand" : "text-ink-500"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
