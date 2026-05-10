import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NZ_DEFAULTS } from "@/lib/quote-defaults";
import { AppHeader } from "../_components/AppHeader";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "business_name, email, phone, address, gst_number, country, currency, tax_label, tax_rate, default_labour_rate, default_markup_pct",
    )
    .eq("id", user.id)
    .maybeSingle();

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

        <SettingsForm initial={initial} />
      </main>
    </div>
  );
}
