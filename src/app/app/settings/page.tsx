import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { NZ_DEFAULTS } from "@/lib/quote-defaults";
import type {
  AdminClientSnapshot,
  AdminProfileSnapshot,
} from "@/lib/agents/admin";
import { AppHeader } from "../_components/AppHeader";
import { AdminChecklistPanel } from "../_components/agents/AdminChecklistPanel";
import { SettingsForm, type SettingsInitial } from "./_components/SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

/**
 * /app/settings — editable profile settings.
 *
 * Wave 10 — the read-only `<Row>` view is gone; the page now loads the
 * profile row, hydrates the client `<SettingsForm />`, and lets the user
 * save via the `saveSettings` server action.
 *
 * Defense-in-depth:
 *   - `auth.getUser()` on the server, `redirect("/login")` if unset.
 *   - The form upserts using `user.id` as the row PK; the existing
 *     `profiles_*_own` RLS policies make any other id impossible.
 *
 * No write happens on this page — writes go through the server action in
 * `actions.ts`.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Wave 14 — fetch profile + a slim clients snapshot so the inline
  // AdminChecklistPanel can flag setup gaps (business name, labour
  // rate, GST, clients without contact). Same RLS pattern the
  // settings form already uses — auth.uid() owns the rows.
  const [{ data: profile }, { data: clientsRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "business_name, email, phone, address, gst_number, country, currency, tax_label, tax_rate, default_labour_rate, default_markup_pct",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, email, phone")
      .eq("user_id", user.id),
  ]);

  const adminProfile: AdminProfileSnapshot | null = profile
    ? {
        business_name: profile.business_name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        gst_number: profile.gst_number,
        country: profile.country,
        currency: profile.currency,
        tax_rate:
          typeof profile.tax_rate === "number" ? profile.tax_rate : null,
        default_labour_rate:
          typeof profile.default_labour_rate === "number"
            ? profile.default_labour_rate
            : null,
        default_markup_pct:
          typeof profile.default_markup_pct === "number"
            ? profile.default_markup_pct
            : null,
      }
    : null;

  const adminClients: AdminClientSnapshot = {
    count: clientsRows?.length ?? 0,
    countWithoutContact: (clientsRows ?? []).filter(
      (c) =>
        !(typeof c.email === "string" && c.email.trim().length > 0) &&
        !(typeof c.phone === "string" && c.phone.trim().length > 0),
    ).length,
  };

  // Inputs need string values. Falling back to NZ defaults for fresh
  // accounts keeps the form populated rather than blank.
  const initial: SettingsInitial = {
    business_name: profile?.business_name ?? "",
    email: profile?.email ?? user.email ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    gst_number: profile?.gst_number ?? "",
    country: (profile?.country ?? NZ_DEFAULTS.country) || "NZ",
    currency: (profile?.currency ?? NZ_DEFAULTS.currency) || "NZD",
    tax_label: (profile?.tax_label ?? NZ_DEFAULTS.tax_label) || "GST",
    tax_rate:
      typeof profile?.tax_rate === "number"
        ? String(profile.tax_rate)
        : String(NZ_DEFAULTS.tax_rate),
    default_labour_rate:
      typeof profile?.default_labour_rate === "number"
        ? String(profile.default_labour_rate)
        : String(NZ_DEFAULTS.default_labour_rate),
    default_markup_pct:
      typeof profile?.default_markup_pct === "number"
        ? String(profile.default_markup_pct)
        : String(NZ_DEFAULTS.default_markup_pct),
  };

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Settings" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10">
          <div className="t2q-section-label mb-3">{"// your tools"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Settings.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Business details and quote defaults. Saved values appear on every
            quote PDF and feed the AI generator.
          </p>
        </div>

        {/* Wave 14 — Admin Agent checklist moved here from /app/agents
            (which is now owner-only). Every tradie sees their setup
            gaps here, with one-tap links to the field below that fixes
            each item. Read-only. */}
        <AdminChecklistPanel profile={adminProfile} clients={adminClients} />

        <SettingsForm initial={initial} />

        {/* Sign out lives here instead of the app header so the mobile
            top bar can stay compact. Signed-in email is shown for
            context so the user knows whose session they're ending. */}
        <section
          data-testid="settings-sign-out-block"
          className="t2q-premium-card-static mt-10 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div className="min-w-0">
            <p className="font-display text-sm uppercase tracking-tight text-white">
              Signed in as
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-ink-300">
              {user.email ?? "—"}
            </p>
          </div>
          {/* Wave 13.2 — POSTs to the /auth/signout route handler so
              cookie clearing lands on the redirect response and the
              middleware can't refresh the session. */}
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              data-testid="settings-sign-out"
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-ink-600 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900"
            >
              <SignOut size={14} weight="bold" />
              Sign out
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
