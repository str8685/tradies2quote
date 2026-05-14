import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getCachedAuthUser } from "@/lib/supabase/auth";
import type { QuoteData } from "@/lib/quote-types";
import { quoteNumber } from "@/lib/quote-defaults";
import {
  runQuoteReview,
  type ReviewSeverity,
} from "@/lib/agents/quote-review";
import {
  logAgentRunStart,
  logAgentRunFinish,
  newRunId,
} from "@/lib/agent-monitor/logger";

/**
 * Quote Review Agent — server component.
 *
 * Picks the most recent active quote owned by the caller, runs
 * `runQuoteReview` (which combines readiness + compliance into a
 * single fix list), and renders the fixes inline. Each fix has a
 * deep link to the quote editor where it can be addressed.
 *
 * No DB writes from this component. To persist "addressed" markers,
 * a future migration can add a `review` JSON sub-key inside
 * `quotes.quote_data`. The reader `getAddressedSet()` from the
 * library already supports that shape.
 */
const SEVERITY_STYLES: Record<
  ReviewSeverity,
  { tone: string; icon: typeof Warning }
> = {
  missing: {
    tone: "border-red-700/60 bg-red-950/30 text-red-200",
    icon: WarningOctagon,
  },
  warning: {
    tone: "border-hivis/40 bg-hivis/5 text-hivis",
    icon: Warning,
  },
  info: {
    tone: "border-ink-600 bg-ink-800/60 text-ink-200",
    icon: ClipboardText,
  },
};

export async function QuoteReviewAgent() {
  const { user } = await getCachedAuthUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: quote }, { data: profile }] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, status, quote_data, expires_at, created_at",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("business_name, email, phone, address")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!quote) {
    return (
      <section
        data-testid="quote-review-agent"
        className="t2q-premium-card-static p-5 sm:p-6"
      >
        <Header />
        <div className="mt-5 rounded-sm border border-ink-700 bg-ink-900/40 p-4 text-sm text-ink-300">
          You don&apos;t have any quotes yet — once you create one, this panel
          will show the readiness + compliance fixes for your most recent
          quote.
          <div className="mt-3">
            <Link
              href="/app/quotes/new"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-brand hover:text-hivis"
            >
              Start a quote
              <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const quoteData = (quote.quote_data ?? null) as QuoteData | null;
  const report = runQuoteReview(quoteData, profile ?? null, quote.expires_at);

  // Telemetry — fire-and-forget, never throws, never blocks the render.
  try {
    const runId = newRunId("qrev");
    logAgentRunStart({
      agentName: "Quote Review Agent",
      runId,
      stepName: "run.start",
      status: "running",
      message: "Reviewing the latest quote for readiness + compliance",
      quoteId: quote.id,
    });
    logAgentRunFinish({
      agentName: "Quote Review Agent",
      runId,
      stepName: "run.finish",
      status: "complete",
      message: `Reviewed — ${report.summary.missing} missing, ${report.summary.warning} warning(s), ${report.summary.info} info`,
      quoteId: quote.id,
    });
  } catch {
    // Telemetry failures must never break the page render.
  }

  const headline = quoteData?.client?.name?.trim() || "Untitled quote";
  const number = quoteNumber(quote.id, quote.created_at);

  return (
    <section
      data-testid="quote-review-agent"
      className="t2q-premium-card-static p-5 sm:p-6"
    >
      <Header />
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-200">
          Reviewing the latest quote:{" "}
          <span className="font-display uppercase tracking-tight text-white">
            {headline}
          </span>{" "}
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            · {number}
          </span>
        </p>
        <Link
          href={`/app/quotes/preview/${quote.id}`}
          data-testid="quote-review-open-quote"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-brand hover:text-hivis"
        >
          Open quote
          <ArrowRight size={12} weight="bold" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <SummaryPill label="Missing" count={report.summary.missing} tone="missing" />
        <SummaryPill label="Warnings" count={report.summary.warning} tone="warning" />
        <SummaryPill label="Info" count={report.summary.info} tone="info" />
      </div>

      {report.fixes.length === 0 ? (
        <div className="mt-4 rounded-sm border border-brand/40 bg-brand/10 p-3 text-sm text-brand">
          <CheckCircle size={14} weight="fill" className="mr-1 inline-block" />
          No fixes needed — quote is ready to send.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {report.fixes.map((f) => {
            const style = SEVERITY_STYLES[f.severity];
            const Icon = style.icon;
            return (
              <li
                key={f.id}
                data-testid={`quote-review-fix-${f.id}`}
                className={`flex items-start gap-3 rounded-sm border p-3 text-sm ${style.tone}`}
              >
                <Icon size={14} weight="bold" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm uppercase tracking-tight text-white">
                    {f.title}
                  </p>
                  <p className="mt-1 text-xs text-ink-300">{f.fix}</p>
                </div>
                <Link
                  href={`/app/quotes/preview/${quote.id}#${f.area}`}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 hover:text-brand"
                >
                  Fix
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand">
        <ClipboardText size={20} weight="bold" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
          Quote Review Agent
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          Reviews your most recent quote for missing scope, GST, exclusions,
          payment terms, and over-promising language. Click a fix to jump
          straight to that part of the quote.
        </p>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: ReviewSeverity;
}) {
  const cls = SEVERITY_STYLES[tone].tone;
  return (
    <div
      data-testid={`quote-review-summary-${tone}`}
      className={`rounded-sm border px-3 py-2 ${cls}`}
    >
      <p className="font-display tabular-nums leading-none text-white text-lg">
        {count}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        {label}
      </p>
    </div>
  );
}
