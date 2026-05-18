import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Warning,
  Info,
} from "@phosphor-icons/react/dist/ssr";
import {
  runAdminAgent,
  summarizeAdmin,
  type AdminClientSnapshot,
  type AdminFinding,
  type AdminProfileSnapshot,
  type AdminSummary,
} from "@/lib/agents/admin";

/**
 * Wave 14 — inline Admin checklist for `/app/settings`.
 *
 * Same `runAdminAgent` logic the `/app/agents` AdminAgent panel uses.
 * Wave 13 owner-only gated `/app/agents`, which hid the setup nudge
 * from every non-owner tradie. This panel restores that surface for
 * everyone — every tradie sees their own setup gaps on Settings.
 *
 * Server component. No client state. Each finding's "Fix" link goes
 * to an existing settings section, never an agent action.
 */
interface Props {
  profile: AdminProfileSnapshot | null;
  clients: AdminClientSnapshot;
}

export function AdminChecklistPanel({ profile, clients }: Props) {
  const findings = runAdminAgent(profile, clients);
  const summary = summarizeAdmin(findings);

  return (
    <section
      data-testid="admin-checklist-panel"
      aria-label="Business setup checklist"
      className="t2q-card-pro mb-6 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="t2q-section-label-pro">{"// business setup"}</span>
        <span
          data-testid="admin-checklist-summary"
          className={`ml-auto inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${summaryPill(summary.status)}`}
        >
          {summary.ready}/{summary.total} complete
        </span>
      </div>
      <h2 className="mt-3 font-display text-xl uppercase tracking-tight text-white sm:text-2xl">
        {summaryHeadline(summary)}
      </h2>
      <p className="mt-2 text-sm text-ink-200">
        {summaryBody(summary)}
      </p>

      <ul className="mt-5 space-y-3">
        {findings.map((f) => (
          <li
            key={f.id}
            data-testid={`admin-finding-${f.id}`}
            className="flex items-start gap-3 border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              {findingGlyph(f.status)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm uppercase tracking-tight text-white">
                {f.label}
              </p>
              <p className="mt-0.5 text-xs text-ink-300">{f.detail}</p>
            </div>
            {f.status !== "complete" ? (
              <Link
                href={f.fixHref}
                data-testid={`admin-finding-${f.id}-fix`}
                className="inline-flex shrink-0 items-center gap-1 self-start font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 hover:text-brand"
              >
                Fix <ArrowRight size={10} weight="bold" />
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className="shrink-0 self-start font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300"
              >
                Done
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
        <Info size={12} weight="bold" />
        Read-only. Every Fix link opens the matching settings field — nothing changes until you save it there.
      </p>
    </section>
  );
}

function findingGlyph(status: AdminFinding["status"]) {
  if (status === "complete")
    return <CheckCircle size={16} weight="fill" className="text-brand" />;
  if (status === "warn")
    return <Warning size={16} weight="fill" className="text-hivis" />;
  return <Info size={16} weight="fill" className="text-red-400" />;
}

function summaryPill(s: AdminSummary["status"]) {
  if (s === "ready")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (s === "review") return "border-hivis/40 bg-hivis/10 text-hivis";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function summaryHeadline(s: AdminSummary): string {
  if (s.status === "ready") return "Setup complete.";
  if (s.status === "review") return "Setup ready — a few amber notes.";
  const missingWord = s.missing === 1 ? "item" : "items";
  return `${s.missing} red ${missingWord} recommended before sending.`;
}

function summaryBody(s: AdminSummary): string {
  if (s.status === "ready") return "Your details are good to go on every quote PDF.";
  if (s.status === "missing")
    // Wave 14 — wording moved from "Fix before sending" (which read
    // like a hard block) to advisory. The Send action does NOT gate
    // on this checklist; these are recommendations so the client PDF
    // shows real business details instead of "Your business".
    return "Recommended before sending: filling these in means clients see your real business name, contact, and rates on every quote PDF.";
  return "Setup is workable; review the amber items when you have a moment.";
}
