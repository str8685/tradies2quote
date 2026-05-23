import Link from "next/link";
import { ArrowSquareOut, Brain } from "@phosphor-icons/react/dist/ssr";
import { deriveConfidence } from "@/lib/tradieBrain/normalize";
import type { MemoryConfidence, MemoryType, TradieMemory } from "@/lib/tradieBrain/types";

type Props = {
  memories: TradieMemory[];
};

const TYPE_LABEL: Record<MemoryType, string> = {
  preferred_material: "Preferred materials",
  preferred_brand: "Preferred brands",
  preferred_supplier: "Preferred suppliers",
  common_exclusion: "Common exclusions",
  pricing_habit: "Pricing habits",
  tone_preference: "Wording / tone",
  repeated_correction: "Repeated corrections",
  job_type_preference: "Job types",
  quote_outcome: "Quote outcomes",
};

const TYPE_ORDER: MemoryType[] = [
  "preferred_material",
  "preferred_supplier",
  "pricing_habit",
  "job_type_preference",
  "common_exclusion",
  "repeated_correction",
  "preferred_brand",
  "tone_preference",
  "quote_outcome",
];

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Plain-English one-liner for a memory's value. */
function memoryLabel(m: TradieMemory): string {
  const v = m.value ?? {};
  switch (m.memory_type) {
    case "preferred_material":
    case "preferred_brand": {
      const name = String(v.name ?? m.memory_key);
      const price = num(v.unit_price);
      const unit = typeof v.unit === "string" ? v.unit : "each";
      return price != null ? `${name} — $${price}/${unit}` : name;
    }
    case "preferred_supplier":
      return String(v.supplier ?? m.memory_key);
    case "common_exclusion":
      return String(v.text ?? m.memory_key);
    case "pricing_habit": {
      const mk = num(v.markup_pct);
      return mk != null ? `Markup ~${mk}%` : m.memory_key;
    }
    case "job_type_preference":
      return String(v.job_type ?? m.memory_key);
    case "repeated_correction": {
      const field = String(v.field ?? "field");
      const desc = String(v.description ?? m.memory_key);
      const to = v.to;
      return `${field} on "${desc}"${to != null ? ` → ${String(to)}` : ""}`;
    }
    default:
      return m.memory_key;
  }
}

function confTone(c: MemoryConfidence): string {
  return c === "high"
    ? "border-brand/40 bg-brand/10 text-brand"
    : c === "medium"
      ? "border-hivis/40 bg-hivis/10 text-hivis"
      : "border-ink-600 bg-ink-800 text-ink-300";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString() : "—";
}

/**
 * Presentational owner-only view of a tradie's accumulated memories. No data
 * fetching, no server-only imports — renderable via renderToStaticMarkup.
 * Groups by type and shows, for each memory: what it learned, derived
 * confidence, observation count (strength), where it came from (source +
 * quote link), and when it was last seen / used.
 */
export function MemoryList({ memories }: Props) {
  if (memories.length === 0) {
    return (
      <div
        data-testid="brain-empty"
        className="t2q-card-pro p-6 text-center sm:p-8"
      >
        <Brain size={28} weight="duotone" className="mx-auto mb-3 text-ink-400" />
        <p className="font-display text-base uppercase tracking-tight text-white">
          No memories yet.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-300">
          Tradie Brain learns from your own saved quotes — preferred materials
          and prices, your usual markup, suppliers, exclusions and the fixes you
          make. Save a quote and they&apos;ll show up here. Nothing is shared
          and nothing is fed to the AI yet.
        </p>
      </div>
    );
  }

  const byType = new Map<MemoryType, TradieMemory[]>();
  for (const m of memories) {
    const list = byType.get(m.memory_type) ?? [];
    list.push(m);
    byType.set(m.memory_type, list);
  }

  const groups = TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
    type: t,
    items: (byType.get(t) ?? []).sort((a, b) => b.strength - a.strength),
  }));

  return (
    <div data-testid="brain-list" className="space-y-6">
      {groups.map((g) => (
        <section
          key={g.type}
          data-testid={`brain-group-${g.type}`}
          className="t2q-card-pro p-5 sm:p-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base uppercase tracking-tight text-white sm:text-lg">
              {TYPE_LABEL[g.type]}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              {g.items.length}
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {g.items.map((m) => {
              const confidence = deriveConfidence(m.strength);
              const quoteId = m.provenance?.quote_id;
              return (
                <li
                  key={m.id}
                  data-testid="brain-memory"
                  className="border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 text-sm text-white">
                      {memoryLabel(m)}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] ${confTone(confidence)}`}
                    >
                      {confidence} · ×{m.strength}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-400">
                    <span>via {m.source.replace(/_/g, " ")}</span>
                    <span>seen {fmtDate(m.last_seen_at)}</span>
                    <span>used {fmtDate(m.last_used_at)}</span>
                    {quoteId && (
                      <Link
                        href={`/app/quotes/preview/${quoteId}`}
                        className="inline-flex items-center gap-1 text-ink-300 hover:text-brand"
                      >
                        <ArrowSquareOut size={11} weight="bold" />
                        source quote
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
