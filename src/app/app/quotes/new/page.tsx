import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWrite, getSubscriptionStatus } from "@/lib/subscription";
import { AppHeader } from "../../_components/AppHeader";
import { QuoteInputTabs } from "./_components/QuoteInputTabs";

export const metadata: Metadata = {
  title: "New quote",
};

export default async function NewQuotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Trial-expired users land on the upgrade page instead of the
  // recorder. They can still view + send existing quotes (those pages
  // don't gate), so this is the single chokepoint that enforces the
  // read-only contract my trial-end emails promised.
  const sub = await getSubscriptionStatus({
    userId: user.id,
    signedUpAt: new Date(user.created_at ?? Date.now()),
    email: user.email,
  });
  if (!canWrite(sub)) {
    redirect("/app/upgrade?from=new-quote");
  }

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="New quote" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label-pro mb-3">{"// step 1 of 3"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Describe the <span className="text-brand">job.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Talk it through, or type it out. Either way — we turn it into a quote.
          </p>
        </div>

        <QuoteInputTabs />
      </main>
    </div>
  );
}
