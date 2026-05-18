import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  GearSix,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr";
import {
  runAdminAgent,
  summarizeAdmin,
  type AdminClientSnapshot,
  type AdminProfileSnapshot,
  type AdminSeverity,
} from "@/lib/agents/admin";

/**
 * Admin Agent — checks the user's profile + clients for setup gaps.
 *
 * Read-only. Every "Apply" is a `<Link>` to an existing page (Settings
 * or Clients). The agent itself never modifies anything.
 *
 * Server component; takes the profile + client snapshot the caller
 * already loaded so we don't double-fetch.
 */
interface Props {
  profile: AdminProfileSnapshot | null;
  clients: AdminClientSnapshot;
}

const SEVERITY_GLYPH: Record<AdminSeverity, React.ReactNode> = {
  complete: <CheckCircle size={14} weight="fill" />,
  warn: <Warning size={14} weight="fill" />,
  missing: <WarningOctagon size={14} weight="fill" />,
};

const SEVERITY_STYLES: Record<AdminSeverity, string> = {
  complete: "text-brand",
  warn: "text-hivis",
  missing: "text-red-300",
};

const SUMMARY_STYLES: Record<
  ReturnType<typeof summarizeAdmin>["status"],
  { wrapper: string; label: string; title: string }
> = {
  ready: {
    wrapper: "border-brand/40 bg-brand/10",
    label: "text-brand",
    title: "All set — quotes are ready to send",
  },
  review: {
    wrapper: "border-hivis/40 bg-hivis/10",
    label: "text-hivis",
    title: "A few things to review",
  },
  missing: {
    wrapper: "border-red-500/40 bg-red-500/10",
    label: "text-red-300",
    title: "Missing setup — quotes will look incomplete",
  },
};

export function AdminAgent({ profile, clients }: Props) {
  const findings = runAdminAgent(profile, clients);
  const summary = summarizeAdmin(findings);
  const banner = SUMMARY_STYLES[summary.status];

  return (
    <section
      data-testid="agent-admin"
      data-admin-status={summary.status}
      className="t2q-card-pro p-5 sm:p-7"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand"
        >
          <GearSix size={20} weight="bold" />
        </span>
        <div>
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Admin Agent.
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
            {"// read-only · every apply links to a settings page"}
          </p>
        </div>
      </div>

      {/* Summary banner */}
      <div
        className={`mt-5 flex items-start gap-3 rounded-sm border p-4 ${banner.wrapper}`}
      >
        <span aria-hidden="true" className={`mt-0.5 shrink-0 ${banner.label}`}>
          {summary.status === "ready" ? (
            <CheckCircle size={20} weight="fill" />
          ) : summary.status === "review" ? (
            <Warning size={20} weight="fill" />
          ) : (
            <WarningOctagon size={20} weight="fill" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-base uppercase tracking-tight sm:text-lg ${banner.label}`}>
            {banner.title}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            {summary.ready}/{summary.total} complete
            {summary.warn > 0 ? ` · ${summary.warn} review` : ""}
            {summary.missing > 0 ? ` · ${summary.missing} missing` : ""}
          </p>
        </div>
      </div>

      {/* Findings list */}
      <ul className="mt-5 divide-y divide-ink-700/60">
        {findings.map((f) => (
          <li
            key={f.id}
            data-testid={`agent-admin-finding-${f.id}`}
            data-admin-status={f.status}
            className="flex flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                aria-hidden="true"
                className={`mt-1 shrink-0 ${SEVERITY_STYLES[f.status]}`}
              >
                {SEVERITY_GLYPH[f.status]}
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm uppercase tracking-tight text-white">
                  {f.label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-ink-300">
                  {f.detail}
                </p>
              </div>
            </div>
            <Link
              href={f.fixHref}
              data-testid={`agent-admin-fix-${f.id}`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 self-stretch rounded-sm border border-ink-600 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900 sm:self-auto"
            >
              {f.fixLabel}
              <ArrowRight size={12} weight="bold" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
