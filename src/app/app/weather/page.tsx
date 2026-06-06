import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CloudSun, Lock } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "../_components/AppHeader";
import { WeatherImpactClient } from "./_components/WeatherImpactClient";
import { getCachedAuthUser } from "@/lib/supabase/auth";
import { isOwnerEmail } from "@/lib/owner";
import { isWeatherImpactEnabled } from "@/lib/weather-impact";

export const metadata: Metadata = {
  title: "Weather Impact",
};

export const dynamic = "force-dynamic";

export default async function WeatherImpactPage() {
  const { user } = await getCachedAuthUser();
  if (!user) redirect("/login");

  const enabled = isWeatherImpactEnabled(isOwnerEmail(user.email));

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Weather Impact" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link href="/app" className="t2q-btn-back mb-4">
              <ArrowLeft size={15} weight="bold" />
              Dashboard
            </Link>
            <p className="t2q-section-label-pro">{"// job site decision tool"}</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">
              Weather Impact.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300 sm:text-base">
              Pick the trade, set the site conditions, and get a deterministic
              safe / caution / unsafe call with the exact reasons.
            </p>
          </div>
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
            <CloudSun size={26} weight="bold" aria-hidden="true" />
          </span>
        </div>

        {enabled ? (
          <WeatherImpactClient />
        ) : (
          <section className="t2q-card-pro p-6">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
                <Lock size={24} weight="bold" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xl font-semibold text-white">
                  Weather Impact is in owner testing.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">
                  This keeps the new safety engine behind a rollout gate until
                  the rules and wording have been checked on real job examples.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
