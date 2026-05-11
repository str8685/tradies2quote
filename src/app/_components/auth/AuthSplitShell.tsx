import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

/**
 * Shared split-screen frame for /login and /signup.
 *
 * Layout:
 *
 *   lg:  [ visual / marketing panel ]  [ form panel ]
 *   sm:                                 form panel only (visual hidden)
 *
 * Server-component-friendly: takes the panel content as render props
 * (`visual` and `form`). The "← Back" link in the top-left of the form
 * panel goes to `backHref` (defaults to `/`). Reuses the landing
 * `<Logo>` SVG for the brand mark.
 *
 * The auth pages handle their own server actions via children — this
 * shell never touches form state, error handling, or actions.
 */
type Props = {
  /** Left/visual panel (hidden on mobile). */
  visual: ReactNode;
  /** Right/form panel (always visible). */
  form: ReactNode;
  /** Where the back link points. Defaults to `/`. */
  backHref?: string;
  /** Reverse panels — visual on RIGHT instead of LEFT. */
  reverse?: boolean;
};

export function AuthSplitShell({
  visual,
  form,
  backHref = "/",
  reverse = false,
}: Props) {
  return (
    <div
      data-testid="auth-split-shell"
      className="min-h-screen grid lg:grid-cols-2 bg-ink-900 text-white"
    >
      {/* Wave 12.3 — marketing panel is no longer aria-hidden. It now
          contains a real scrollable story ("how it works", "what you
          get", "built for", "safety promise") that fades+slides in as
          the user scrolls. aria-label is descriptive so screen readers
          announce the panel without reading the entire scroll story. */}
      <aside
        aria-label="What Tradies2Quote does"
        className={[
          "hidden lg:flex relative bg-ink-950 overflow-hidden lg:max-h-screen",
          reverse ? "lg:order-2 border-l border-ink-700" : "border-r border-ink-700",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 t2q-grid-bg opacity-40" />
        <div className="pointer-events-none absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-brand/30 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full bg-hivis/15 blur-3xl animate-blob-slow" />
        <div className="relative flex w-full flex-col p-10 lg:p-12 xl:p-16 overflow-y-auto">
          {visual}
        </div>
      </aside>

      <div className="relative flex flex-col px-6 py-8 sm:px-10 sm:py-12 lg:p-14">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={backHref}
            data-testid="auth-back"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-white"
          >
            <ArrowLeft size={14} weight="bold" /> Back
          </Link>
          <Link
            href="/"
            aria-label="tradies2Quote home"
            className="lg:hidden inline-flex"
          >
            {/* Wave 12.3 — new Tradies2Quote brand mark on a small
                white pill. Replaces the old inline Site-Safe Badge. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.png"
              alt="Tradies2Quote"
              width={160}
              height={136}
              className="block h-7 w-auto rounded-sm bg-white px-1.5 py-0.5"
            />
          </Link>
        </div>

        <div className="mt-8 lg:mt-12 flex-1 flex flex-col">
          <Link
            href="/"
            aria-label="tradies2Quote home"
            className="hidden lg:inline-flex mb-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-horizontal.png"
              alt="Tradies2Quote"
              width={380}
              height={100}
              className="block h-9 w-auto rounded-sm bg-white px-2 py-1"
            />
          </Link>
          <div className="w-full max-w-md mx-auto lg:mx-0">{form}</div>
        </div>
      </div>
    </div>
  );
}
