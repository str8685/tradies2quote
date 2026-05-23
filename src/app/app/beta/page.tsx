import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, Warning } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../_components/AppHeader";

export const metadata: Metadata = { title: "Beta — before you send" };
export const dynamic = "force-dynamic";

/**
 * Small in-app beta guidance page — the target of the dismissible beta
 * notice's "Read before sending quotes" link. Login-gated by proxy.ts;
 * getUser + redirect here as defense-in-depth. Visible to all beta users
 * (owner + mates) — not owner-only.
 */
const CHECKS = [
  "Materials & quantities are right — especially from a drawing or supplier scan.",
  "Every line has a price — nothing sitting at $0 by accident (the app will warn you).",
  "The total and GST look right for the job.",
  "Supplier-quote imports: the lines match the supplier's quote (the app blocks if they don't).",
  "Drawings: you've confirmed the key dimensions when the app asks.",
];

export default async function BetaHelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Beta" />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="t2q-section-label-pro mb-3">{"// beta"}</div>
        <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
          Before you send.
        </h1>
        <p className="mt-3 text-sm text-ink-300 sm:text-base">
          You&apos;re one of the first tradies on Tradies2Quote. It&apos;s
          solid — but you&apos;re the final check on every quote. The app flags
          and blocks the risky stuff; you make the call.
        </p>

        <section
          aria-label="Pre-send checklist"
          className="t2q-card-pro mt-8 p-5 sm:p-7"
        >
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
            <Warning size={14} weight="fill" />
            Before sending any quote, check
          </p>
          <ul className="mt-4 space-y-3">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm text-ink-100">
                <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-brand" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-sm text-ink-300">
          If something&apos;s off, fix it in the quote first — or flag it to
          Challis.
        </p>

        <Link
          href="/app"
          className="mt-8 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400 hover:text-brand"
        >
          <ArrowLeft size={12} weight="bold" />
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
