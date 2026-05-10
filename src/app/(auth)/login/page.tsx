import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { AuthSplitShell } from "../../_components/auth/AuthSplitShell";
import { LoginForm } from "./_components/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
};

const TRUST = [
  "Voice in. Quote out. Under 60 seconds",
  "Built by a builder · Tauranga, NZ",
  "Cancel by text — we don't lock you in",
];

/**
 * /login — split-screen sign-in.
 *
 * Visual side (RIGHT, hidden on mobile, mirrors the /signup left panel
 * inverted): "// for the tools" eyebrow, "Voice in. Quote out." headline,
 * 3-bullet trust list, "1,243 tradies" ticker.
 * Form side (LEFT): "// sign in" eyebrow, "Welcome back" headline,
 * email/password form, forgot-password + signup links.
 *
 * Server-rendered. Form lives in a small client subcomponent
 * (`LoginForm`) which owns the eye-toggle + magnetic CTA hooks; it
 * submits to the unchanged Supabase `loginAction` server action with
 * email + password + optional `next`.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  return (
    <AuthSplitShell
      backHref="/"
      reverse
      visual={
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-hivis mb-3">
            {"// for the tools"}
          </div>
          <h2 className="font-display text-4xl sm:text-5xl uppercase tracking-tighter leading-[0.9]">
            Voice in.
            <br />
            <span className="text-brand">Quote out.</span>
            <br />
            Under 60 seconds.
          </h2>
          <p className="mt-6 text-ink-200 leading-relaxed max-w-md">
            Built by a builder. No drag-and-drop, no menus, no time-suckers —
            just talk.
          </p>

          <ul className="mt-8 space-y-3 max-w-md">
            {TRUST.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 text-sm text-ink-100"
              >
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
            {"// sign in"}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tighter leading-[0.95]">
            Welcome <span className="text-brand">back.</span>
          </h1>
          <p className="text-ink-300 mt-3">Pick up where you left off.</p>

          <div className="mt-8">
            <LoginForm next={next} error={error} message={message} />
          </div>
        </>
      }
    />
  );
}
