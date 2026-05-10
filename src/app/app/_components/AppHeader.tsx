import Link from "next/link";
import { InstallAppButton } from "@/app/_components/InstallAppButton";
import { signOutAction } from "../actions";

/**
 * Shared header for every `/app/*` page.
 *
 * Before this component, each route inlined its own `<header>` and they
 * drifted apart over time — three different max-widths (720 / 768 / 1024),
 * two competing patterns (branded vs "← Dashboard" mini-header), and the
 * dashboard nav was orphaned on the dashboard only. This single header
 * makes the logged-in app feel like one product.
 *
 * Design:
 *   - Logo wordmark on the left (links to `/app`, replaces every prior
 *     "← Dashboard" back link).
 *   - Optional `context` shown next to the logo in mono micro-caps so the
 *     user always knows which page they're on (e.g. "Materials · Capture",
 *     "Q-2026-XXXX").
 *   - Nav on the right: Materials, Clients, Settings, the existing PWA
 *     install button (renders nothing when irrelevant), and a sign-out
 *     form posting to the existing `signOutAction`.
 *
 * Layout: single 56px row at `sm:` and up. Below `sm`, the header stacks
 * — logo on top, nav row beneath — so the four nav items + install +
 * sign-out aren't cramped on a 390-px phone. `flex-wrap` on the nav lets
 * any of those items wrap to a second line if the user's chosen font
 * size makes them wider than expected.
 *
 * Server-component-only. No new state, no new hooks, no new server
 * actions — re-uses `signOutAction` from `src/app/app/actions.ts`.
 */
interface AppHeaderProps {
  /** Optional page label shown next to the logo. */
  context?: string;
}

export function AppHeader({ context }: AppHeaderProps) {
  return (
    <header className="border-b border-ink-700 bg-ink-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app"
            data-testid="app-header-home"
            className="shrink-0 font-display text-base uppercase tracking-tight text-white sm:text-lg"
          >
            tradies<span className="text-brand">2</span>Quote
          </Link>
          {context ? (
            <>
              <span
                aria-hidden="true"
                className="hidden text-ink-600 sm:inline"
              >
                ·
              </span>
              <span
                data-testid="app-header-context"
                className="truncate font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400 sm:text-xs"
              >
                {context}
              </span>
            </>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/app/materials"
            data-testid="app-header-materials"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            Materials
          </Link>
          <Link
            href="/app/clients"
            data-testid="app-header-clients"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            Clients
          </Link>
          <Link
            href="/app/settings"
            data-testid="app-header-settings"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            Settings
          </Link>
          {/* Renders nothing when the app is already installed or the
              browser can't install — see InstallAppButton.tsx. */}
          <InstallAppButton />
          <form action={signOutAction}>
            <button
              type="submit"
              data-testid="app-header-sign-out"
              className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
