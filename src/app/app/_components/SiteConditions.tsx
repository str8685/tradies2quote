// ── Site conditions — weather-aware planning inside the Workboard ──────────
// DASHBOARD OWNERSHIP: weather lives HERE, inside the Today/Workboard area —
// NOT as a standalone dashboard feature card. Renders, per scheduled job: title,
// risk level, short reason (the deterministic summary), Pat's recommendation,
// and a "Review Willa draft" button when a customer-comms draft exists.
//
// Reads only (RLS-scoped to the user). The risk/summary/triggers were decided by
// the deterministic engine and stored; this component never computes risk and
// never sends a message. Flag-gated: renders nothing when the feature is off.

import { createClient } from "@/lib/supabase/server";
import { isWeatherPlanningEnabled } from "@/lib/weather-planning/flag";
import type { PatOutput } from "@/lib/weather-planning/types";
import type { QuoteData } from "@/lib/quote-types";
import { CloudSun } from "@phosphor-icons/react/dist/ssr";
import { WillaDraftReview } from "./WillaDraftReview";

type RiskLevel = "low" | "medium" | "high";

const RISK_STYLE: Record<RiskLevel, { label: string; cls: string }> = {
  high: { label: "High risk", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  medium: { label: "Caution", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  low: { label: "Good to go", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
};

interface Row {
  quoteId: string;
  title: string;
  risk: RiskLevel;
  summary: string;
  recommendedAction: string;
  pat: PatOutput | null;
  draft: { channel: "sms" | "email" | "none"; message: string; reason: string } | null;
}

export async function SiteConditions({ userId }: { userId: string }) {
  // OWNERSHIP: the feature flag gates the whole block. Off → nothing renders.
  if (!isWeatherPlanningEnabled()) return null;

  const supabase = await createClient();

  // Latest assessment per scheduled job (RLS-scoped to this user).
  const { data: assessments } = await supabase
    .from("job_weather_assessments")
    .select("id, quote_id, risk_level, summary, recommended_action, generated_at")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(60);

  if (!assessments?.length) {
    return (
      <p className="mt-4 text-sm leading-relaxed text-ink-300">
        No site conditions yet. Schedule a job with a trade and address and Pat will check the
        forecast for its work window.
      </p>
    );
  }

  // Keep only the most recent assessment per quote.
  const latest = new Map<string, (typeof assessments)[number]>();
  for (const a of assessments) {
    if (!latest.has(a.quote_id)) latest.set(a.quote_id, a);
  }
  const picked = [...latest.values()].slice(0, 6);
  const assessmentIds = picked.map((a) => a.id);
  const quoteIds = picked.map((a) => a.quote_id);

  const [{ data: recs }, { data: drafts }, { data: quotes }] = await Promise.all([
    supabase.from("ai_recommendations").select("assessment_id, output").in("assessment_id", assessmentIds),
    supabase
      .from("customer_message_drafts")
      .select("assessment_id, channel, message, reason, status")
      .in("assessment_id", assessmentIds)
      .neq("status", "dismissed"),
    supabase.from("quotes").select("id, quote_data").in("id", quoteIds),
  ]);

  const recByAssessment = new Map((recs ?? []).map((r) => [r.assessment_id, r.output as unknown as PatOutput]));
  const draftByAssessment = new Map((drafts ?? []).map((d) => [d.assessment_id, d]));
  const titleByQuote = new Map(
    (quotes ?? []).map((q) => {
      const qd = q.quote_data as QuoteData | null;
      return [q.id, (qd?.job_summary as string | undefined) ?? "Scheduled job"];
    }),
  );

  const rows: Row[] = picked.map((a) => {
    const draft = draftByAssessment.get(a.id);
    return {
      quoteId: a.quote_id,
      title: titleByQuote.get(a.quote_id) ?? "Scheduled job",
      risk: (a.risk_level as RiskLevel) ?? "low",
      summary: a.summary ?? "",
      recommendedAction: a.recommended_action ?? "",
      pat: recByAssessment.get(a.id) ?? null,
      draft:
        draft && draft.message
          ? { channel: (draft.channel as "sms" | "email" | "none") ?? "none", message: draft.message, reason: draft.reason ?? "" }
          : null,
    };
  });

  // Surface the riskiest jobs first.
  const order: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
  rows.sort((x, y) => order[x.risk] - order[y.risk]);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <CloudSun size={16} weight="bold" className="text-brand" aria-hidden="true" />
        <p className="t2q-section-label-pro">{"// site conditions"}</p>
      </div>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => {
          const style = RISK_STYLE[row.risk];
          return (
            <li key={row.quoteId} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{row.title}</p>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style.cls}`}>
                  {style.label}
                </span>
              </div>
              {row.summary ? <p className="mt-1.5 text-xs leading-relaxed text-ink-300">{row.summary}</p> : null}

              {row.pat ? (
                <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">{"// pat · field planning"}</p>
                  <p className="mt-1 text-sm font-medium text-white">{row.pat.risk_headline}</p>
                  <p className="mt-1 text-xs text-ink-300">{row.pat.recommended_action}</p>
                  {row.pat.alternate_option && row.pat.alternate_option.toLowerCase() !== "none needed" ? (
                    <p className="mt-1 text-xs text-ink-400">Fallback: {row.pat.alternate_option}</p>
                  ) : null}
                </div>
              ) : null}

              {row.draft ? (
                <WillaDraftReview channel={row.draft.channel} message={row.draft.message} reason={row.draft.reason} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
