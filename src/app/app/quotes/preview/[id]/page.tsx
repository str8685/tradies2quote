import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import type { LibraryMaterial, QuoteData, QuoteStatus } from "@/lib/quote-types";
import { quoteNumber } from "@/lib/quote-defaults";
import type { ComplianceLineItem, ComplianceReview } from "@/lib/compliance";
import { isOwnerEmail } from "@/lib/owner";
import type { InvoiceSummary, InvoiceStatus } from "@/lib/types/invoice";
import { orchestrate } from "@/lib/lifecycle/orchestrator";
import {
  checkQuoteReadiness,
  summarizeReadiness,
} from "@/lib/quote-readiness";
import { runComplianceAgent } from "@/lib/agents/compliance";
import { runInvoiceAgent } from "@/lib/agents/invoice";
import { detectForgottenCosts } from "@/lib/agents/forgotten-costs";
import {
  logAgentApprovalNeeded,
  logAgentEvent,
} from "@/lib/agent-monitor/logger";
import { AppHeader } from "../../../_components/AppHeader";
import { QuoteReadinessCheck } from "../../../_components/QuoteReadinessCheck";
import { ComplianceAgent } from "../../../_components/agents/ComplianceAgent";
import { FollowupAgent } from "../../../_components/agents/FollowupAgent";
import { VoiceCleanupAgent } from "../../../_components/agents/VoiceCleanupAgent";
import { ForgottenCostsAgent } from "../../../_components/agents/ForgottenCostsAgent";
import { QuoteGenerator } from "./_components/QuoteGenerator";
import { QuoteEditor } from "./_components/QuoteEditor";
import { CompliancePanel } from "./_components/CompliancePanel";
import { LifecycleCard } from "./_components/LifecycleCard";
import { CollapsibleSection } from "./_components/CollapsibleSection";
import { InvoiceDraftCard } from "./_components/InvoiceDraftCard";
import { ReviewToolsSheet } from "./_components/ReviewToolsSheet";
import {
  TranscriptPanel,
  type TranscriptPanelData,
} from "./_components/TranscriptPanel";

export const metadata: Metadata = {
  title: "Quote preview",
};

type Params = { id: string };

export default async function QuotePreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, voice_transcript, quote_data, created_at, status, public_token, pdf_path, sent_at, viewed_at, accepted_at, expires_at",
    )
    .eq("id", id)
    .single();

  if (error || !quote) redirect("/app/quotes/new");

  const quoteData = (quote.quote_data ?? null) as QuoteData | null;
  const headerNumber = quoteNumber(quote.id, quote.created_at);

  // Wave 11 — load the user's business profile for the readiness check
  // panel below. Same RLS pattern Settings already uses; same fields
  // the readiness function asks for. Safe to fail silently here.
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, email, phone, address")
    .eq("id", user.id)
    .maybeSingle();

  // Wave 14 — load the existing non-deleted, non-cancelled invoice
  // for this quote if one exists. Drives both the LifecycleCard's
  // suggestion suppression and the InvoiceDraftCard's existing-state
  // branch. RLS already scopes to this user; we further filter by
  // quote_id + deleted_at IS NULL + status <> 'cancelled'.
  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_amount, currency, due_date, created_at")
    .eq("quote_id", id)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .maybeSingle();
  const existingInvoice: InvoiceSummary | null = invoiceRow
    ? {
        id: invoiceRow.id,
        invoice_number: invoiceRow.invoice_number,
        status: invoiceRow.status as InvoiceStatus,
        total_amount: Number(invoiceRow.total_amount) || 0,
        currency: invoiceRow.currency ?? "NZD",
        due_date: invoiceRow.due_date,
        created_at: invoiceRow.created_at,
      }
    : null;

  const { data: libraryRows } = await supabase
    .from("materials")
    .select(
      "id, name, unit, default_unit_price, supplier, supplier_url, notes, usage_count, is_ai_estimated, last_used_at",
    )
    .eq("user_id", user.id);
  const library: LibraryMaterial[] = (libraryRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    default_unit_price:
      r.default_unit_price !== null ? Number(r.default_unit_price) : null,
    supplier: r.supplier,
    supplier_url: r.supplier_url,
    notes: r.notes,
    usage_count: Number(r.usage_count) || 0,
    is_ai_estimated: !!r.is_ai_estimated,
    last_used_at: r.last_used_at,
  }));

  /* --------------------------------------------------------------------
   * Agent observability — fire-and-forget logs to the external monitor
   * dashboard. Each block dual-computes the agent's output server-side
   * so we can post a short safe summary without touching the components
   * below. Only ids, counts, status and short messages are transmitted
   * (see logger PII allow-list).
   *
   * If AGENT_DASHBOARD_URL / AGENT_DASHBOARD_SECRET are unset, every
   * helper is a no-op. Network failures only console.warn.
   * ------------------------------------------------------------------ */
  if (quoteData) {
    const status = (quote.status ?? "draft") as QuoteStatus;

    // 1. Lifecycle Orchestrator — same inputs the LifecycleCard will use.
    try {
      const orchOut = orchestrate({
        status,
        quoteData,
        events: [],
        expiresAt: quote.expires_at ?? null,
        voiceTranscript: quote.voice_transcript ?? null,
        invoiceExists: existingInvoice !== null,
      });
      logAgentEvent({
        agentName: "Lifecycle Orchestrator",
        quoteId: quote.id,
        stepName: "stage.check",
        status: "complete",
        message: `Stage checked: ${orchOut.stage}`,
      });
      if (orchOut.nextAction) {
        logAgentEvent({
          agentName: "Lifecycle Orchestrator",
          quoteId: quote.id,
          stepName: "next-action.suggest",
          status: "complete",
          message: `Next action: ${orchOut.nextAction.buttonLabel}`,
        });
      }
      if (orchOut.approvalNeeded) {
        logAgentApprovalNeeded({
          agentName: "Lifecycle Orchestrator",
          quoteId: quote.id,
          stepName: "approval.needed",
          status: "waiting_approval",
          message: "Owner approval required for next lifecycle action",
        });
      }
    } catch {
      // Pure function shouldn't throw, but defense-in-depth — never
      // let logging break the render.
    }

    // 2. Quote Readiness Agent — count-only summary, no field names.
    try {
      const items = checkQuoteReadiness(
        quoteData,
        profile ?? null,
        quote.expires_at ?? null,
      );
      const sum = summarizeReadiness(items);
      logAgentEvent({
        agentName: "Quote Readiness Agent",
        quoteId: quote.id,
        stepName: "readiness.evaluate",
        status:
          sum.status === "ready"
            ? "complete"
            : sum.status === "review"
              ? "running"
              : "failed",
        message:
          sum.status === "ready"
            ? `Ready · ${sum.ready}/${sum.total} complete`
            : `${sum.missing} missing · ${sum.review} warnings · ${sum.ready}/${sum.total} complete`,
      });
    } catch {
      /* never break render */
    }

    // 3. Voice Cleanup Agent — only "suggested" (the actual cleanup
    //    runs client-side via a button; we cannot log that without a
    //    server action, which is out of scope for this wave).
    if (quote.voice_transcript) {
      logAgentEvent({
        agentName: "Voice Cleanup Agent",
        quoteId: quote.id,
        stepName: "cleanup.suggested",
        status: "pending",
        message: "Transcript present — cleanup available (client-side, no auto-apply)",
      });
    }

    // 4. Follow-up Agent — runs server-side inside <FollowupAgent>,
    //    output is clipboard-only.
    logAgentEvent({
      agentName: "Follow-up Agent",
      quoteId: quote.id,
      stepName: "copy.generated",
      status: "complete",
      message: `Follow-up copy generated · clipboard-only · status=${status}`,
    });

    // 5. Compliance Agent — rule-based pass. If quoteData.compliance_review
    //    is missing, we explicitly note the AI engine is off.
    try {
      const report = runComplianceAgent(quoteData);
      const aiEngineOn = (quoteData.compliance_review ?? null) !== null;
      logAgentEvent({
        agentName: "Compliance Agent",
        quoteId: quote.id,
        stepName: "compliance.check",
        status:
          report.flags.some((f) => f.severity === "high")
            ? "failed"
            : report.flags.length > 0
              ? "running"
              : "complete",
        message: aiEngineOn
          ? `Rule-based: ${report.flags.length} flags, ${report.suggestions.length} suggestions · AI engine on`
          : `Rule-based: ${report.flags.length} flags, ${report.suggestions.length} suggestions · AI compliance engine off (no compliance_review data)`,
      });
    } catch {
      /* never break render */
    }

    // 6. Forgotten-Cost Detector — rule-based margin-leak scan over the
    //    finished quote. Count + total only; no line descriptions.
    try {
      const fc = detectForgottenCosts(quoteData);
      logAgentEvent({
        agentName: "Forgotten-Cost Detector",
        quoteId: quote.id,
        stepName: "scan.complete",
        status: fc.clean ? "complete" : "running",
        message: fc.clean
          ? "No commonly-missed costs flagged"
          : `${fc.costs.length} possibly-missed cost(s) flagged`,
      });
    } catch {
      /* never break render */
    }

    // 7. Invoice Agent — only emits a log when the quote is completed
    //    and no invoice exists yet (the LifecycleCard's "suggested"
    //    state). Draft only — never sends, never bills.
    if (status === "completed" && existingInvoice === null) {
      try {
        const preview = runInvoiceAgent(status, quoteData);
        if (preview.reason === "ready") {
          logAgentEvent({
            agentName: "Invoice Agent",
            quoteId: quote.id,
            stepName: "draft.suggested",
            status: "pending",
            message: `Draft invoice suggested (Draft only) · ${preview.lineItemCount} lines · ${preview.currency}`,
          });
        }
      } catch {
        /* never break render */
      }
    }
  }

  return (
    <div className="min-h-screen text-white">
      <AppHeader context={headerNumber} />

      <main
        data-preview-quote-number={headerNumber}
        className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
      >
        <div className="mb-8">
          <Link
            href="/app/quotes"
            className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400 transition-colors hover:text-ink-100"
          >
            <ArrowLeft weight="bold" className="h-3.5 w-3.5" />
            Back to quotes
          </Link>
          <div className="t2q-section-label mb-3">{"// step 2 of 3"}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
              Review your <span className="text-brand">quote.</span>
            </h1>
            {/* Wave 19.10 — status pill in the header so the operator
                sees the quote's lifecycle stage without scrolling
                down to the sticky bar. Hivis treatment for `draft`
                (attention-grabbing); other statuses keep their
                existing palette via the same map StickyActionBar
                uses. */}
            <HeaderStatusPill status={(quote.status ?? "draft") as QuoteStatus} />
          </div>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Tweak any line, fix the client name, edit the terms — your changes save when you hit save.
          </p>
        </div>

        {quoteData ? (
          <>
            {/* Wave 13 — lifecycle card at the top of the page.
                Wave 14 — also fed voiceTranscript + invoiceExists so
                the orchestrator can suggest Voice Cleanup on draft
                and Invoice on completed (when no invoice yet). */}
            <LifecycleCard
              quoteId={quote.id}
              status={(quote.status ?? "draft") as QuoteStatus}
              quoteData={quoteData}
              expiresAt={quote.expires_at ?? null}
              isOwner={isOwnerEmail(user.email)}
              voiceTranscript={quote.voice_transcript ?? null}
              invoiceExists={existingInvoice !== null}
            />

            {/* Wave 36 — surface transcript clarifications at the top of
                the page (was buried inside the Transcript collapsible
                under Review Tools). When the cleanup layer flagged
                ambiguous phrases ("standard board" → 10mm or 13mm?,
                "a few sheets" → how many?), the tradie should see them
                BEFORE skimming the line items, so they can catch
                AI guesses while reviewing — not after they've already
                hit Send. Each item shows the question + the reason it
                was flagged so the fix is obvious. Stays as a passive
                banner (not a blocking modal) — the proper interactive
                resolution flow lives in a future wave that gates
                generation on these answers up-front. */}
            <ClarificationsBanner quoteData={quoteData} />

            {/* Wave 13.1 — the editor is the primary work surface and
                now sits second so it's above the fold once the user
                scrolls past the lifecycle status. Everything below is
                a review tool tucked behind collapsibles. */}
            <QuoteEditor
              quoteId={quote.id}
              createdAt={quote.created_at}
              initialData={quoteData}
              library={library}
              quoteStatus={(quote.status ?? "draft") as QuoteStatus}
              publicToken={quote.public_token ?? null}
              hasPdf={quote.pdf_path !== null && quote.pdf_path !== undefined}
            />

            {/* Wave 14 — Invoice draft card. Self-hides unless the
                quote is `completed`. The card's id="agent-invoice"
                is what the lifecycle suggestion scrolls to. */}
            <InvoiceDraftCard
              quoteId={quote.id}
              status={(quote.status ?? "draft") as QuoteStatus}
              quoteData={quoteData}
              existingInvoice={existingInvoice}
            />

            {/* Wave 19.10 — review tools collapse behind a single
                "Open review tools" button below md (bottom sheet on
                tap); render inline on md+. ReviewToolsSheet brings
                its own brand-tinted shell + header so the explicit
                <section> wrapper is gone. */}
            <ReviewToolsSheet>
              <CollapsibleSection
                id="agent-quote-review"
                title="Quote Review Agent"
              >
                <QuoteReadinessCheck
                  quoteData={quoteData}
                  profile={profile ?? null}
                  expiresAt={quote.expires_at ?? null}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="agent-forgotten-costs"
                title="Forgotten-Cost Detector"
              >
                <ForgottenCostsAgent quoteData={quoteData} />
              </CollapsibleSection>

              <CollapsibleSection
                id="agent-compliance"
                title="Compliance Agent"
              >
                <ComplianceAgent quoteData={quoteData} />
              </CollapsibleSection>

              {quote.voice_transcript ? (
                <CollapsibleSection
                  id="agent-voice-cleanup"
                  title="Voice Cleanup Agent"
                >
                  <VoiceCleanupAgent
                    transcript={quote.voice_transcript ?? null}
                  />
                </CollapsibleSection>
              ) : null}

              <CollapsibleSection
                id="agent-followup"
                title="Follow-up Agent"
              >
                <FollowupAgent
                  quoteNumber={headerNumber}
                  clientName={quoteData.client?.name ?? null}
                  total={quoteData.total ?? 0}
                  currency={quoteData.currency || "NZD"}
                  status={(quote.status ?? "draft") as QuoteStatus}
                  sentAtIso={quote.sent_at ?? null}
                  businessName={profile?.business_name ?? null}
                />
              </CollapsibleSection>

              {/* Stage 6 transcript panel — only when the generator wrote
                  a transcript object onto quote_data. */}
              {(() => {
                const t = (quoteData.transcript ?? null) as
                  | TranscriptPanelData
                  | null;
                if (!t) return null;
                return (
                  <CollapsibleSection
                    id="agent-transcript"
                    title="Transcript"
                  >
                    <TranscriptPanel quoteId={quote.id} transcript={t} />
                  </CollapsibleSection>
                );
              })()}

              {/* Stage 5 compliance review panel — only when there's a
                  server-side review attached. */}
              {(() => {
                const review = (quoteData.compliance_review ?? null) as
                  | ComplianceReview
                  | null;
                if (!review) return null;
                return (
                  <CollapsibleSection
                    id="agent-compliance-review"
                    title="Compliance Review"
                  >
                    <CompliancePanel
                      quoteId={quote.id}
                      review={review}
                      items={quoteData.line_items as ComplianceLineItem[]}
                    />
                  </CollapsibleSection>
                );
              })()}
            </ReviewToolsSheet>
          </>
        ) : (
          <QuoteGenerator id={quote.id} />
        )}
      </main>
    </div>
  );
}

/**
 * Wave 36 — server-rendered top-of-page banner that surfaces FOUR
 * different signals from the transcript cleanup pass, all of which
 * mean "T2Q wasn't 100% sure and took its best guess":
 *
 *   1. clarification_questions — NZ-tradie homophone ambiguities
 *      from the deterministic regex pass ("jib" without context,
 *      "pink batts" vs timber battens, etc.). Has a structured
 *      {question, why} shape.
 *
 *   2. summary.material_assumptions — materials the LLM inferred
 *      WITHOUT the tradie naming them ("GIB Standard 13mm assumed
 *      for ceiling lining"). Plain string list.
 *
 *   3. summary.missing_information — facts the LLM didn't have
 *      ("wall is internal vs external", "spacing of stud framing").
 *      Plain string list.
 *
 *   4. summary.compliance_risks — code-critical items the LLM is
 *      asking the tradie to confirm before sign-off ("H3.2 treatment
 *      class required for exposed framing"). Plain string list.
 *
 * Why all four in one banner: each one means the same thing to the
 * operator ("I need to double-check this before sending"), and the
 * deterministic homophone list (1) alone has very narrow coverage —
 * surfacing (2)/(3)/(4) catches the cases the regex misses.
 *
 * Defensive: `quoteData.transcript` is typed as `unknown` in
 * quote-types.ts (kept unknown to avoid a circular import with
 * transcriptCleanup.ts). Every accessor below narrows it with a
 * type guard so a missing / malformed / partial transcript object
 * is a silent no-op, never a crash. No collision with the existing
 * <TranscriptPanel> inside the Review Tools sheet — that component
 * still reads the same fields but renders a more detailed view; the
 * banner is the at-a-glance summary at the top of the page.
 */
type ClarificationQuestion = {
  id: string;
  question: string;
  why: string;
};

type ExtractedSignals = {
  questions: ClarificationQuestion[];
  assumptions: string[];
  missing: string[];
  risks: string[];
};

function extractAllSignals(quoteData: QuoteData): ExtractedSignals {
  const empty: ExtractedSignals = {
    questions: [],
    assumptions: [],
    missing: [],
    risks: [],
  };
  const t = quoteData.transcript;
  if (!t || typeof t !== "object") return empty;

  const tObj = t as {
    clarification_questions?: unknown;
    summary?: unknown;
  };

  // Source 1 — structured clarification questions (regex pass).
  const rawQs = tObj.clarification_questions;
  const questions: ClarificationQuestion[] = Array.isArray(rawQs)
    ? rawQs.filter(
        (q): q is ClarificationQuestion =>
          typeof q === "object" &&
          q !== null &&
          typeof (q as ClarificationQuestion).id === "string" &&
          typeof (q as ClarificationQuestion).question === "string" &&
          typeof (q as ClarificationQuestion).why === "string",
      )
    : [];

  // Sources 2/3/4 — LLM summary string arrays.
  let assumptions: string[] = [];
  let missing: string[] = [];
  let risks: string[] = [];
  const summary = tObj.summary;
  if (summary && typeof summary === "object") {
    const s = summary as {
      material_assumptions?: unknown;
      missing_information?: unknown;
      compliance_risks?: unknown;
    };
    const pickStrings = (v: unknown): string[] =>
      Array.isArray(v)
        ? v
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0)
        : [];
    assumptions = pickStrings(s.material_assumptions);
    missing = pickStrings(s.missing_information);
    risks = pickStrings(s.compliance_risks);
  }

  return { questions, assumptions, missing, risks };
}

function ClarificationsBanner({ quoteData }: { quoteData: QuoteData }) {
  const { questions, assumptions, missing, risks } =
    extractAllSignals(quoteData);
  const totalCount =
    questions.length + assumptions.length + missing.length + risks.length;
  if (totalCount === 0) return null;

  return (
    <section
      data-testid="preview-clarifications-banner"
      // Hivis treatment matches the existing "// review these" notes
      // box inside the editor so the operator's eye already associates
      // the colour with "things to check before sending".
      className="mb-6 rounded-sm border border-hivis/50 bg-hivis/10 p-4 sm:p-5"
      aria-label="Things T2Q wasn't sure about"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-hivis/40 bg-hivis/15 text-hivis"
        >
          <WarningCircle size={16} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-hivis">
            {`// t2q wasn't sure · ${totalCount} ${
              totalCount === 1 ? "thing to check" : "things to check"
            }`}
          </p>
          <p className="mt-1 text-sm text-ink-100 sm:text-base">
            Double-check the matching line items below before sending —
            T2Q took its best guess on these.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-4 border-t border-hivis/30 pt-3">
        {questions.length > 0 && (
          <SignalSection
            testId="banner-section-questions"
            title="Unclear phrases"
            items={questions.map((q) => ({
              key: q.id,
              primary: q.question,
              secondary: q.why,
            }))}
          />
        )}
        {assumptions.length > 0 && (
          <SignalSection
            testId="banner-section-assumptions"
            title="T2Q assumed"
            items={assumptions.map((a, i) => ({
              key: `assumption.${i}`,
              primary: a,
            }))}
          />
        )}
        {missing.length > 0 && (
          <SignalSection
            testId="banner-section-missing"
            title="Info T2Q didn't have"
            items={missing.map((m, i) => ({
              key: `missing.${i}`,
              primary: m,
            }))}
          />
        )}
        {risks.length > 0 && (
          <SignalSection
            testId="banner-section-risks"
            title="Code-critical to confirm"
            items={risks.map((r, i) => ({
              key: `risk.${i}`,
              primary: r,
            }))}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Sub-section of the clarifications banner — one header + a list of
 * items. Pure presentational. Items with `secondary` text get a
 * two-line render; assumption / missing-info / compliance-risk items
 * have just a `primary` string. Keeps the banner compact on mobile.
 */
function SignalSection({
  testId,
  title,
  items,
}: {
  testId: string;
  title: string;
  items: Array<{ key: string; primary: string; secondary?: string }>;
}) {
  return (
    <div data-testid={testId}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hivis/80">
        {`// ${title}`}
      </p>
      <ul className="mt-1.5 space-y-1.5 text-sm text-ink-200">
        {items.map((it) => (
          <li key={it.key} className="flex gap-2">
            <span aria-hidden="true" className="text-hivis">
              →
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-white">{it.primary}</p>
              {it.secondary && (
                <p className="mt-0.5 text-xs text-ink-300 sm:text-sm">
                  {it.secondary}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Wave 19.10 — small status pill rendered next to the page H1 so the
 * operator sees the quote's lifecycle stage without scrolling. The
 * `draft` row uses hivis (yellow) to nudge the operator toward the
 * Send action; other statuses keep their existing palette.
 */
function HeaderStatusPill({ status }: { status: QuoteStatus }) {
  const map: Record<QuoteStatus, { label: string; cls: string }> = {
    draft: {
      label: "Draft",
      cls: "border-hivis/40 bg-hivis/10 text-hivis",
    },
    sent: {
      label: "Sent",
      cls: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    },
    viewed: {
      label: "Viewed",
      cls: "border-hivis/40 bg-hivis/10 text-hivis",
    },
    accepted: {
      label: "Accepted",
      cls: "border-brand/40 bg-brand/10 text-brand",
    },
    scheduled: {
      label: "Scheduled",
      cls: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    },
    in_progress: {
      label: "In progress",
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    },
    completed: {
      label: "Completed",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    },
    declined: {
      label: "Declined",
      cls: "border-red-500/40 bg-red-500/10 text-red-300",
    },
    expired: {
      label: "Expired",
      cls: "border-ink-600 bg-ink-800 text-ink-400",
    },
  };
  const pill = map[status] ?? map.draft;
  return (
    <span
      data-testid="header-status-pill"
      className={`inline-flex items-center rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${pill.cls}`}
    >
      {pill.label}
    </span>
  );
}
