import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getKitsWithItems, kitsEnabled } from "@/lib/kits";
import { AppHeader } from "../../_components/AppHeader";
import { KitsManager } from "./_components/KitsManager";

export const metadata: Metadata = {
  title: "Kits",
};

export default async function KitsPage() {
  // Feature flag — until KITS_ENABLED=true this route quietly bounces back to
  // the materials library, so the feature is invisible until switched on.
  if (!kitsEnabled()) redirect("/app/materials");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("currency")
    .eq("id", user.id)
    .maybeSingle();
  const currency = profile?.currency ?? "NZD";

  const kits = await getKitsWithItems();

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Kits" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6">
          <Link
            href="/app/materials"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-900"
          >
            <ArrowLeft size={14} /> Materials
          </Link>
          <div className="t2q-section-label-pro mb-3">{"// one-tap jobs"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Kits <span className="text-brand">&amp; assemblies.</span>
          </h1>
        </div>

        <KitsManager initialKits={kits} currency={currency} />
      </main>
    </div>
  );
}
