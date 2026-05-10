import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "../actions";
import { NZ_DEFAULTS } from "@/lib/quote-defaults";

export const metadata: Metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

/**
 * /app/settings — read-only settings shell.
 *
 * Sections:
 *   - Account         — email + sign out (existing server action)
 *   - Business profile — read-only display from `profiles` row if present;
 *                        edit panel intentionally omitted (no DB writes)
 *   - Quote defaults   — read-only display of NZ_DEFAULTS
 *
 * One Supabase read — `profiles` SELECT(business_name, currency,
 * gst_rate) — same RLS-scoped pattern other /app/* pages already use
 * (e.g. materials list reads profiles too). No INSERT/UPDATE/DELETE.
 *
 * Theme toggle, API status panel, and Stripe billing are intentionally
 * NOT rendered here. They'll come back as a separate wave once the
 * theme provider and edit forms are wired safely.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, currency, gst_rate")
    .eq("id", user.id)
    .maybeSingle();

  const businessName =
    (profile?.business_name as string | null | undefined) ?? "—";
  const currency =
    (profile?.currency as string | undefined) ?? NZ_DEFAULTS.currency;
  // `gst_rate` on the profile row is the user's override; `NZ_DEFAULTS.tax_rate`
  // is the country default. Both are stored as percentages (e.g. 15 → 15%).
  const gstRatePct =
    typeof profile?.gst_rate === "number"
      ? profile.gst_rate
      : NZ_DEFAULTS.tax_rate;

  return (
    <div className="relative min-h-screen text-white">
      <div className="pointer-events-none absolute inset-0 t2q-grid-bg opacity-20" />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10">
          <div className="t2q-section-label mb-3">{"// your tools"}</div>
          <h1 className="font-display text-4xl uppercase tracking-tighter leading-[0.95] sm:text-5xl">
            Settings.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-300 sm:text-lg">
            Read-only for now — wire up edits when you&apos;re ready.
          </p>
        </div>

        <div className="space-y-10">
          <Section title="Account" testId="settings-account">
            <Row label="Signed in as" value={user.email ?? "—"} mono />
            <div className="pt-3">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="t2q-btn-ghost h-10 px-4 text-sm"
                  data-testid="settings-sign-out"
                >
                  <SignOut size={14} weight="bold" /> Sign out
                </button>
              </form>
            </div>
          </Section>

          <Section title="Business profile" testId="settings-business">
            <Row label="Business name" value={businessName} />
            <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {"// edit panel coming soon — keeps your data safe until then"}
            </p>
          </Section>

          <Section title="Quote defaults" testId="settings-quote-defaults">
            <Row label="Currency" value={currency} mono />
            <Row
              label={`${NZ_DEFAULTS.tax_label} rate`}
              value={`${gstRatePct.toFixed(1)}%`}
              mono
            />
            <Row label="Country" value={NZ_DEFAULTS.country} mono />
            <Row
              label="Default labour rate"
              value={`${currency} ${NZ_DEFAULTS.default_labour_rate.toFixed(2)}/hr`}
              mono
            />
            <Row
              label="Default markup"
              value={`${NZ_DEFAULTS.default_markup_pct.toFixed(1)}%`}
              mono
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-sm border border-ink-700 bg-ink-800/60 p-5 sm:p-7"
    >
      <h2 className="font-display text-xl uppercase tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-700/70 pb-2 last:border-b-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
        {label}
      </span>
      <span
        className={[
          "text-sm text-white",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
