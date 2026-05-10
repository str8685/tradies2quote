import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { AuthSplitShell } from "../../_components/auth/AuthSplitShell";
import { SignupForm } from "./_components/SignupForm";

export const metadata: Metadata = {
  title: "Start your free trial",
};

const BENEFITS = [
  "Unlimited quotes & invoices",
  "Branded PDFs in your colours",
  "Auto-converts quote → invoice when client accepts",
  "Cancel by text — we don't lock you in",
];

/**
 * /signup — split-screen sign-up.
 *
 * Visual side (LEFT, hidden on mobile): "Onboard the crew" eyebrow,
 * "Start free." headline, 4-bullet benefits list, "1,243 tradies" ticker.
 * Form side (RIGHT): "Sign up" eyebrow, "Build your account" headline,
 * email + password only (the only fields `signupAction` persists today).
 *
 * Server-rendered. The form is a small client subcomponent
 * (`SignupForm`) which owns the password show/hide toggle and submits to
 * the unchanged Supabase `signupAction`. Decorative name/business/trade
 * fields are deferred until `actions.ts` can persist them.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthSplitShell
      backHref="/"
      visual={
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mb-3">
            {"// onboard the crew"}
          </div>
          <h2 className="font-display text-4xl sm:text-5xl uppercase tracking-tighter leading-[0.9]">
            Start free.
            <br />
            7 days.
            <br />
            <span className="text-brand">No card.</span>
          </h2>
          <p className="mt-6 text-ink-200 leading-relaxed max-w-md">
            90 seconds to set up. Voice your first quote tonight. Send it
            before knock-off.
          </p>

          <ul className="mt-8 space-y-3 max-w-md">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-ink-100">
                <Check
                  size={16}
                  weight="bold"
                  className="text-brand shrink-0 mt-0.5"
                />
                {b}
              </li>
            ))}
          </ul>

          <div className="flex-1" />

          <div className="mt-10 inline-flex items-center gap-2 border border-ink-600 bg-ink-900/60 px-3 py-1.5 rounded-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200">
              1,243 tradies on the tools — NZ · AU · UK · US · CA
            </span>
          </div>
        </>
      }
      form={
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mb-3">
            {"// sign up"}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tighter leading-[0.95]">
            Build your <span className="text-brand">account.</span>
          </h1>
          <p className="text-ink-300 mt-3">
            Email and password — that&apos;s all we need to get you started.
          </p>

          <div className="mt-8">
            <SignupForm error={error} />
          </div>
        </>
      }
    />
  );
}
