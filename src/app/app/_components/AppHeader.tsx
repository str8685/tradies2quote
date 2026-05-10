"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { InstallAppButton } from "@/app/_components/InstallAppButton";
import { signOutAction } from "../actions";

/**
 * Shared header for every `/app/*` page.
 *
 * Wave 10 rewrite — proper SaaS tab bar:
 *   - Logo on the left, always links to /app.
 *   - Optional `context` next to the logo (e.g. "Materials · Capture",
 *     "Q-2026-XXXX") so users always know which sub-page they're on.
 *   - Five primary tabs across the middle/right: Dashboard, Quotes,
 *     Materials, Clients, Settings. Active tab gets the brand-orange
 *     pill background + 2px underline accent (see `.t2q-nav-tab` in
 *     globals.css).
 *   - Install PWA button (renders nothing when not applicable).
 *   - Sign out moved into a clear outlined ghost button at the far right
 *     so it stops disappearing into the mono micro-caps strip it used to
 *     live in.
 *
 * Client-component-only because we need `usePathname()` for the active
 * indicator. `signOutAction` is still a server action; importing it
 * across the client/server boundary is fine — Next 16 handles the RPC.
 *
 * Mobile (< sm): everything except the logo + sign-out hides; the user
 * navigates via `<MobileBottomNav />` mounted in /app/layout.tsx.
 */
interface AppHeaderProps {
  /** Optional page label shown next to the logo. */
  context?: string;
}

const TABS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/quotes", label: "Quotes" },
  { href: "/app/materials", label: "Materials" },
  { href: "/app/clients", label: "Clients" },
  { href: "/app/settings", label: "Settings" },
] as const;

/**
 * Returns true when the current pathname falls inside the given tab.
 *
 * Special-case `/app` (dashboard) because every other tab href is also a
 * prefix of some path; otherwise visiting `/app/materials` would light up
 * the Dashboard tab as well.
 */
function isActiveTab(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader({ context }: AppHeaderProps) {
  const pathname = usePathname() ?? "";

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur supports-[backdrop-filter]:bg-ink-950/70"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0 sm:px-6">
        {/* Logo + context */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app"
            data-testid="app-header-home"
            aria-label="Tradies2Quote dashboard"
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

        {/* Desktop tabs + actions. Hidden on mobile — the user navigates
            via MobileBottomNav instead. */}
        <div className="hidden items-center gap-2 sm:flex">
          <nav
            data-testid="app-header-tabs"
            aria-label="Primary"
            className="flex items-center gap-1"
          >
            {TABS.map((tab) => {
              const active = isActiveTab(tab.href, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="t2q-nav-tab"
                  aria-current={active ? "page" : undefined}
                  data-testid={`app-header-tab-${tab.label.toLowerCase()}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-2 flex items-center gap-2 border-l border-ink-700 pl-3">
            {/* Renders nothing when the app is already installed or the
                browser can't install — see InstallAppButton.tsx. */}
            <InstallAppButton />
            <form action={signOutAction}>
              <button
                type="submit"
                data-testid="app-header-sign-out"
                className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-ink-600 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900"
              >
                <SignOut size={14} weight="bold" />
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Mobile-only compact action: sign-out access stays visible at
            the top right even though the tabs themselves move to the
            bottom nav. Kept here as a small icon button to avoid trapping
            users with no obvious exit. */}
        <form action={signOutAction} className="sm:hidden self-end">
          <button
            type="submit"
            data-testid="app-header-sign-out-mobile"
            aria-label="Sign out"
            className="inline-flex h-9 items-center gap-1 rounded-sm border border-ink-600 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-200 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900"
          >
            <SignOut size={14} weight="bold" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
