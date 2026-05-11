import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle,
  Info,
  Warning,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../_components/AppHeader";
import {
  getAgentReadiness,
  getAllHealthChecks,
  getBuildIdentity,
  type AgentReadiness,
  type HealthStatus,
} from "@/lib/health-checks";
import { DeviceInfoClient } from "./_components/DeviceInfoClient";

export const metadata: Metadata = {
  title: "Debug",
};

export const dynamic = "force-dynamic";

/**
 * Owner-only debug page.
 *
 * Wave 11. Visible only to the project owner (compared by email,
 * lower-cased + trimmed). Anyone else who lands here sees a 404 from
 * `notFound()` — Next 16's standard hidden-route pattern. This avoids
 * exposing the route's existence to other authenticated users.
 *
 * Read-only by design. Never shows env-var values, key prefixes, or
 * anything else that could leak into a screenshot. The health-checks
 * module returns only `{ status: "ok" | "missing" | "error", detail }`.
 */
const OWNER_EMAIL = "challis836@gmail.com";

export default async function DebugPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owner check — anyone else just gets a 404 so the route's existence
  // isn't advertised.
  const callerEmail = (user.email ?? "").trim().toLowerCase();
  if (callerEmail !== OWNER_EMAIL.toLowerCase()) notFound();

  const checks = await getAllHealthChecks();
  const build = getBuildIdentity();
  const agents = getAgentReadiness();

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Debug" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label mb-3">{"// owner"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            App health.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Live status of the services Tradies2Quote needs. Read-only and
            owner-only. No secrets are displayed.
          </p>
        </div>

        {/* Service health checks */}
        <section
          aria-label="Service health"
          data-testid="debug-services"
          className="t2q-premium-card-static mb-8 p-5 sm:p-7"
        >
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Services.
          </h2>
          <ul className="mt-5 space-y-3">
            {checks.map((c) => (
              <li
                key={c.id}
                data-testid={`debug-service-${c.id}`}
                className="flex items-start gap-3 border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0">
                  {statusGlyph(c.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm uppercase tracking-tight text-white">
                    {c.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-300">{c.detail}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${statusPill(c.status)}`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Build identity */}
        <section
          aria-label="Build"
          data-testid="debug-build"
          className="t2q-premium-card-static mb-8 p-5 sm:p-7"
        >
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Build.
          </h2>
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <DebugRow
              label="Commit SHA"
              value={
                build.commitSha ? build.commitSha.slice(0, 10) : "Local build"
              }
            />
            <DebugRow label="Branch" value={build.branch ?? "—"} />
            <DebugRow label="Vercel env" value={build.vercelEnv ?? "local"} />
            <DebugRow label="Node env" value={build.nodeEnv} />
            <DebugRow
              label="Deploy URL"
              value={build.vercelUrl ? build.vercelUrl : "—"}
            />
            <DebugRow
              label="Commit message"
              value={
                build.commitMessage
                  ? build.commitMessage.split("\n")[0]
                  : "—"
              }
            />
          </dl>
        </section>

        {/* Session identity */}
        <section
          aria-label="Session"
          data-testid="debug-session"
          className="t2q-premium-card-static mb-8 p-5 sm:p-7"
        >
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Session.
          </h2>
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <DebugRow label="Email" value={user.email ?? "—"} />
            <DebugRow
              label="User ID"
              value={`${user.id.slice(0, 8)}…${user.id.slice(-4)}`}
            />
            <DebugRow
              label="Created at"
              value={
                user.created_at
                  ? new Date(user.created_at).toLocaleString()
                  : "—"
              }
            />
            <DebugRow
              label="Last sign-in"
              value={
                user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : "—"
              }
            />
          </dl>
        </section>

        {/* Wave 12 — agent readiness. Same pattern as the services
            panel above: status + detail, never an env value. */}
        <section
          aria-label="Agents"
          data-testid="debug-agents"
          className="t2q-premium-card-static mb-8 p-5 sm:p-7"
        >
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Agents.
          </h2>
          <ul className="mt-5 space-y-3">
            {agents.map((a) => (
              <li
                key={a.id}
                data-testid={`debug-agent-${a.id}`}
                data-agent-status={a.status}
                className="flex items-start gap-3 border-b border-ink-700/60 pb-3 last:border-b-0 last:pb-0"
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0">
                  {agentGlyph(a.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm uppercase tracking-tight text-white">
                    {a.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-300">{a.detail}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${agentPill(a.status)}`}
                >
                  {a.status === "ready"
                    ? "ready"
                    : a.status === "needs-setup"
                      ? "needs setup"
                      : "coming later"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Client-side device info — runs on the client only */}
        <DeviceInfoClient />

        <p className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <Info size={12} weight="bold" />
          This page is owner-only. Other accounts get a 404.
        </p>
      </main>
    </div>
  );
}

function agentGlyph(status: AgentReadiness["status"]) {
  if (status === "ready")
    return <CheckCircle size={18} weight="fill" className="text-brand" />;
  if (status === "needs-setup")
    return <Warning size={18} weight="fill" className="text-hivis" />;
  return <Info size={18} weight="fill" className="text-ink-300" />;
}

function agentPill(status: AgentReadiness["status"]) {
  if (status === "ready") return "border-brand/40 bg-brand/10 text-brand";
  if (status === "needs-setup")
    return "border-hivis/40 bg-hivis/10 text-hivis";
  return "border-ink-600 bg-ink-800 text-ink-300";
}

function statusGlyph(status: HealthStatus) {
  if (status === "ok")
    return <CheckCircle size={18} weight="fill" className="text-brand" />;
  if (status === "missing")
    return <Warning size={18} weight="fill" className="text-hivis" />;
  return <XCircle size={18} weight="fill" className="text-red-400" />;
}

function statusPill(status: HealthStatus) {
  if (status === "ok") return "border-brand/40 bg-brand/10 text-brand";
  if (status === "missing")
    return "border-hivis/40 bg-hivis/10 text-hivis";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-ink-700/40 pb-3 last:border-b-0 sm:border-b-0 sm:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300">
        {label}
      </dt>
      <dd className="font-mono text-xs text-white break-all">{value}</dd>
    </div>
  );
}

