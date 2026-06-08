import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Info, Stack } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { quoteNumber } from "@/lib/quote-defaults";
import type { QuoteData } from "@/lib/quote-types";
import { mapLinesToCsi } from "@/lib/takeoff/csi/map";
import { summariseCsiLines } from "@/lib/takeoff/csi/eval";
import type {
  CsiDivision,
  CsiProvenance,
  CsiSourceLine,
} from "@/lib/takeoff/csi/contracts";
import type { TakeoffStatus } from "@/lib/takeoff/schemas";
import { AppHeader } from "../../_components/AppHeader";

export const metadata: Metadata = { title: "CSI grouping (preview)" };
export const dynamic = "force-dynamic";

/**
 * Owner-only PREVIEW of the Stage-1 CSI mapping layer.
 *
 * Read-only and additive. Picks an existing quote, runs the pure
 * `mapLinesToCsi` over its `quote_data.line_items`, and renders the
 * MasterFormat-divisioned view. Touches NOTHING in the live review/quote
 * flow — it never writes, never recalculates, never re-prices. Non-owners
 * get a 404 (same hidden-route pattern as the rest of /app/debug).
 */
export default async function CsiPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerEmail(user.email)) notFound();

  const sp = await searchParams;
  const selectedId = typeof sp.quote === "string" ? sp.quote : null;

  const { data: recentRows } = await supabase
    .from("quotes")
    .select("id, created_at, quote_data")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(12);

  const recent = (recentRows ?? []).map((q) => ({
    id: q.id as string,
    number: quoteNumber(q.id as string, q.created_at as string),
  }));

  // Aggregate (read-only) eval across the owner's own quotes. RLS + the
  // user_id filter mean this only ever sees the owner's data. Pure mapping —
  // no writes, no recalculation, no repricing.
  const { data: aggRows } = await supabase
    .from("quotes")
    .select("quote_data")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  const aggLines: CsiSourceLine[] = (aggRows ?? []).flatMap((r) => {
    const qd = (r.quote_data ?? null) as QuoteData | null;
    return (qd?.line_items ?? []) as CsiSourceLine[];
  });
  const aggregate = aggLines.length
    ? summariseCsiLines(aggLines, { topN: 15 })
    : null;

  let selectedQd: QuoteData | null = null;
  if (selectedId) {
    const { data: q } = await supabase
      .from("quotes")
      .select("id, quote_data")
      .eq("id", selectedId)
      .eq("user_id", user.id)
      .maybeSingle();
    selectedQd = (q?.quote_data ?? null) as QuoteData | null;
  }

  const grouped = selectedQd
    ? mapLinesToCsi(selectedQd.line_items ?? [])
    : null;

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="CSI preview" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label-pro mb-3">{"// owner · preview"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            CSI grouping.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Read-only preview of the Stage-1 CSI / MasterFormat mapping layer.
            Groups an existing quote&rsquo;s line items into trade divisions.
            Calculates nothing, prices nothing, changes nothing.
          </p>
        </div>

        {/* Aggregate eval across all the owner's quotes (read-only) */}
        {aggregate && (
          <section
            aria-label="All quotes aggregate"
            className="t2q-card-pro mb-8 p-5 sm:p-7"
          >
            <h2 className="font-display text-lg uppercase tracking-tight sm:text-xl">
              All my quotes — eval.
            </h2>
            <p className="mt-1 text-xs text-ink-300">
              Stage-1 mapping measured across your{" "}
              {aggLines.length} line items (read-only). Uncategorized stays
              visible — nothing is guessed.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-3">
              <AggStat label="total" value={aggregate.total} />
              <AggStat label="mapped" value={aggregate.mapped} tone="brand" />
              <AggStat label="03 concrete" value={aggregate.byDivision["03_concrete"]} />
              <AggStat label="05 metals" value={aggregate.byDivision["05_metals"]} />
              <AggStat label="06 wood/plastics" value={aggregate.byDivision["06_wood_plastics"]} />
              <AggStat label="07 thermal/moist" value={aggregate.byDivision["07_thermal_moisture"]} />
              <AggStat label="09 finishes" value={aggregate.byDivision["09_finishes"]} />
              <AggStat label="uncategorized" value={aggregate.uncategorized} tone="hivis" />
              <AggStat label="non-material" value={aggregate.nonMaterial} />
              <AggStat label="manual-review" value={aggregate.manualReview} tone="hivis" />
              <AggStat label="blocked" value={aggregate.blocked} tone={aggregate.blocked ? "red" : undefined} />
            </div>

            {aggregate.topUncategorized.length > 0 && (
              <div className="mt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
                  Top uncategorized material strings
                </p>
                <ul className="mt-2 space-y-1.5">
                  {aggregate.topUncategorized.map((u) => (
                    <li
                      key={u.description}
                      className="flex items-start justify-between gap-3 border-b border-ink-700/50 pb-1.5 text-xs last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 text-white">{u.description}</span>
                      <span className="shrink-0 font-mono text-ink-400">×{u.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Quote picker */}
        <section
          aria-label="Pick a quote"
          className="t2q-card-pro mb-8 p-5 sm:p-7"
        >
          <h2 className="font-display text-lg uppercase tracking-tight sm:text-xl">
            Pick a quote.
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {recent.length === 0 && (
              <p className="text-sm text-ink-300">No quotes yet.</p>
            )}
            {recent.map((q) => (
              <Link
                key={q.id}
                href={`/app/debug/csi?quote=${q.id}`}
                className={`inline-flex items-center rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
                  q.id === selectedId
                    ? "border-brand/50 bg-brand/10 text-brand"
                    : "border-ink-600 bg-ink-800 text-ink-300 hover:border-brand/40"
                }`}
              >
                {q.number}
              </Link>
            ))}
          </div>
        </section>

        {grouped && (
          <>
            {/* Totals header */}
            <div className="mb-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
              <span className="rounded-sm border border-brand/40 bg-brand/10 px-2 py-1 text-brand">
                {grouped.totals.mapped} mapped
              </span>
              <span className="rounded-sm border border-hivis/40 bg-hivis/10 px-2 py-1 text-hivis">
                {grouped.totals.uncategorized} uncategorized
              </span>
              {grouped.totals.blocked > 0 && (
                <span className="rounded-sm border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-300">
                  {grouped.totals.blocked} blocked
                </span>
              )}
            </div>

            {grouped.divisions.map((d) => (
              <section
                key={d.division}
                aria-label={DIVISION_LABEL[d.division]}
                className="t2q-card-pro mb-6 p-5 sm:p-6"
              >
                <h3 className="flex items-center gap-2 font-display text-base uppercase tracking-tight">
                  <Stack size={18} weight="duotone" className="text-brand" />
                  {DIVISION_LABEL[d.division]}
                </h3>
                <ul className="mt-4 space-y-3">
                  {d.lines.map((l, i) => (
                    <li
                      key={`${l.source_description}-${i}`}
                      className="flex items-start gap-3 border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white">{l.source_description}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                          {l.quantity ?? "—"} {l.unit ?? ""} · {l.trade} ·{" "}
                          {l.mapping_basis.join(", ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`${PILL_BASE} ${provenancePill(l.provenance)}`}>
                          {l.provenance}
                        </span>
                        {l.takeoff_status && l.takeoff_status !== "ok" && (
                          <span className={`${PILL_BASE} ${statusPill(l.takeoff_status)}`}>
                            {l.takeoff_status}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {grouped.uncategorized.length > 0 && (
              <section
                aria-label="Uncategorized"
                className="t2q-card-pro mb-6 border-hivis/30 p-5 sm:p-6"
              >
                <h3 className="font-display text-base uppercase tracking-tight text-hivis">
                  Uncategorized — needs a policy decision.
                </h3>
                <p className="mt-1 text-xs text-ink-300">
                  No rule matched confidently. These are surfaced explicitly,
                  never guessed into a division.
                </p>
                <ul className="mt-4 space-y-3">
                  {grouped.uncategorized.map((l, i) => (
                    <li
                      key={`${l.source_description}-${i}`}
                      className="flex items-start justify-between gap-3 border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white">{l.source_description}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                          {l.mapping_basis.join(", ")}
                        </p>
                      </div>
                      <span className={`csi-pill ${provenancePill(l.provenance)}`}>
                        {l.provenance}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {!grouped && selectedId && (
          <p className="text-sm text-ink-300">
            That quote has no readable line items.
          </p>
        )}

        <p className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <Info size={12} weight="bold" />
          Owner-only preview. Read-only. Does not affect any quote.
        </p>
      </main>
    </div>
  );
}

const PILL_BASE =
  "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em]";

function AggStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "brand" | "hivis" | "red";
}) {
  const color =
    tone === "brand"
      ? "text-brand"
      : tone === "hivis"
        ? "text-hivis"
        : tone === "red"
          ? "text-red-300"
          : "text-white";
  return (
    <div className="rounded-sm border border-ink-700/60 bg-ink-900/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.18em] text-ink-400">
        {label}
      </div>
      <div className={`mt-0.5 text-sm ${color}`}>{value}</div>
    </div>
  );
}

const DIVISION_LABEL: Record<Exclude<CsiDivision, "uncategorized">, string> = {
  "03_concrete": "Division 03 — Concrete",
  "05_metals": "Division 05 — Metals",
  "06_wood_plastics": "Division 06 — Wood & Plastics",
  "07_thermal_moisture": "Division 07 — Thermal & Moisture",
  "09_finishes": "Division 09 — Finishes",
};

function provenancePill(p: CsiProvenance): string {
  switch (p) {
    case "calculated":
      return "border-brand/40 bg-brand/10 text-brand";
    case "blocked":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    case "ai_estimated":
      return "border-hivis/40 bg-hivis/10 text-hivis";
    default:
      return "border-ink-600 bg-ink-800 text-ink-300";
  }
}

function statusPill(s: TakeoffStatus): string {
  if (s === "blocked") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (s === "needs_review") return "border-hivis/40 bg-hivis/10 text-hivis";
  return "border-ink-600 bg-ink-800 text-ink-300";
}
