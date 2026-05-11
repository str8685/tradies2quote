"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  House,
  ListBullets,
  Microphone,
  Stack,
  UserCircle,
  X,
} from "@phosphor-icons/react";

/**
 * First-run onboarding tour — Wave 15.4.
 *
 * A 5-step bottom sheet that mounts in `app/layout.tsx` and shows the
 * first time a user opens any /app page. State lives in localStorage
 * (`t2q-tour-done`) so we don't need a schema migration — the tour
 * is a one-shot intro, not something that has to follow the user
 * across devices. Tradies typically use one phone.
 *
 * The tour is pure React + Tailwind — no animation library, no DOM
 * measurement / coachmark overlays. Each step describes a feature
 * in plain language and highlights the matching Phosphor icon so
 * the user can visually map the step to the live nav once dismissed.
 *
 * The sheet is mounted as a fixed-position element above everything
 * else (`z-[80]`) but stays BELOW the tape-measure splash on entry
 * (which is `z-[100]`), so it only appears once the splash finishes
 * and the dashboard becomes visible.
 *
 * Safety: this component reads only `localStorage`. It NEVER calls
 * Supabase, never imports the agent logger. Server-rendering it
 * returns null (we only mount the tour after a client effect
 * confirms it hasn't been seen).
 */

const STORAGE_KEY = "t2q-tour-done";

type StepIcon = typeof House;
interface Step {
  title: string;
  body: string;
  Icon: StepIcon;
  /** Optional caption pinned at the bottom of the card with a // prefix. */
  hint?: string;
}

const STEPS: ReadonlyArray<Step> = [
  {
    title: "Welcome to Tradies²Quote",
    body: "Voice-first quoting for tradies. Record a job in plain English, get a tidy quote in under a minute.",
    Icon: House,
    hint: "// 5 quick tips before you start",
  },
  {
    title: "Record a quote",
    body: "Tap the orange Record button on the Quotes tab. Speak naturally — the AI handles materials, labour and markup.",
    Icon: Microphone,
    hint: "// no typing required",
  },
  {
    title: "Quotes list",
    body: "All your quotes live here, grouped by stage: draft, sent, viewed, accepted, scheduled, completed. Tap any one to review or send.",
    Icon: ListBullets,
    hint: "// your pipeline at a glance",
  },
  {
    title: "Materials library",
    body: "Your prices, your supplier links. Add as you go — the AI learns from your edits and stops guessing.",
    Icon: Stack,
    hint: "// the more you add, the smarter it gets",
  },
  {
    title: "The Me tile",
    body: "Bottom-right circle. Profile, business details, quote defaults, clients, sign out — and your avatar photo.",
    Icon: UserCircle,
    hint: "// you're set — start with your first quote",
  },
];

export function OnboardingTour() {
  // Server-side: hidden. Client decides whether to show.
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // Defer the localStorage read into a 0ms timer so the setState
    // lives in a subscribed callback (React 19's
    // `react-hooks/set-state-in-effect`).
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
      } catch {
        // localStorage unavailable → just skip the tour silently.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore — re-showing the tour on next visit is fine if storage fails
    }
    setOpen(false);
  };

  if (!open) return null;
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-labelledby="onboarding-title"
      data-testid="onboarding-tour"
      // Backdrop. z-[80] keeps it under the entry splash (z-[100])
      // and above the bottom nav (z-50) + sticky headers (z-30).
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border-t border-ink-700 bg-ink-950 p-5 pb-[calc(env(safe-area-inset-bottom,0)+1.25rem)] sm:max-w-md sm:rounded-2xl sm:border sm:p-6"
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-ink-900"
          >
            <step.Icon size={22} weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              {`step ${idx + 1} of ${STEPS.length}`}
            </p>
            <h2
              id="onboarding-title"
              className="mt-1 font-display text-lg uppercase tracking-tight text-white sm:text-xl"
            >
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Skip tour"
            data-testid="onboarding-skip"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-ink-700 text-ink-300 hover:border-brand hover:text-brand"
          >
            <X size={14} weight="bold" />
          </button>
        </header>

        <p className="text-sm leading-relaxed text-ink-200">
          {step.body}
        </p>
        {step.hint ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {step.hint}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === idx ? "bg-brand" : "bg-ink-700"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {idx > 0 ? (
              <button
                type="button"
                onClick={() => setIdx((v) => Math.max(0, v - 1))}
                data-testid="onboarding-back"
                className="inline-flex h-10 items-center rounded-sm border border-ink-700 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-200 hover:border-brand hover:text-brand"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={isLast ? dismiss : () => setIdx((v) => v + 1)}
              data-testid={isLast ? "onboarding-done" : "onboarding-next"}
              className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-brand px-4 font-display text-xs uppercase tracking-tight text-ink-900 hover:bg-brand/90"
            >
              {isLast ? "Get started" : "Next"}
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
