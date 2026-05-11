"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearSix, SignOut } from "@phosphor-icons/react";
import { InstallAppButton } from "@/app/_components/InstallAppButton";
import { ThemeToggle } from "@/app/_components/landing/ThemeToggle";
import { signOutAction } from "../actions";

/**
 * Shared header for every `/app/*` page.
 *
 * Wave 10 — Wave 10.1 compact-mobile patch:
 *   - Mobile header is a SINGLE row of fixed 56 px height (`h-14`). No
 *     stacked second row, no sign-out button hijacking the bar. Sign-out
 *     now lives at the bottom of `/app/settings`.
 *   - Desktop header is 64 px (`sm:h-16`), with the existing tab strip +
 *     the theme toggle moved over from the landing-only nav + the PWA
 *     install button + the outlined Sign-out button.
 *   - Backdrop blur only runs at `sm:` and up — mobile uses an opaque
 *     `bg-ink-950/95` instead, which is much cheaper to scroll over.
 *   - Optional page context (e.g. "Materials · Capture", "Q-2026-XXXX")
 *     is now `sm:` and up only, so the mobile row stays compact even on
 *     pages with long labels.
 *
 * Client component because the active-tab indicator needs `usePathname()`.
 * `signOutAction` is still a server action; importing it across the
 * client/server boundary is fine — Next 16 handles the RPC.
 */
interface AppHeaderProps {
  /** Optional page label shown next to the logo on desktop only. */
  context?: string;
}

const TABS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/quotes", label: "Quotes" },
  { href: "/app/materials", label: "Materials" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/clients", label: "Clients" },
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
      className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 sm:bg-ink-950/85 sm:backdrop-blur"
    >
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
        {/* Logo + (desktop-only) page context. */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app"
            data-testid="app-header-home"
            aria-label="Tradies2Quote dashboard"
            className="inline-flex shrink-0 items-center"
          >
            {/* Wave 10.2 — new Tradies2Quote brand PNGs.
                Both variants sit on a small white pill so the dark T/Q
                stays readable on dark mode AND on the cream light theme.
                The pill is shorter than the surrounding header chrome so
                it reads as a brand badge, not a heavy block.
                Falls back gracefully — `public/logo-mark.svg` and
                `public/logo-horizontal.svg` are still on disk if we ever
                need to revert. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.png"
              alt="Tradies2Quote"
              width={160}
              height={136}
              className="block h-7 w-auto rounded-sm bg-white px-1.5 py-0.5 sm:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-horizontal.png"
              alt="Tradies2Quote"
              width={380}
              height={100}
              className="hidden h-8 w-auto rounded-sm bg-white px-2 py-1 sm:block"
            />
          </Link>
          {context ? (
            <span
              data-testid="app-header-context"
              className="hidden min-w-0 items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-ink-400 sm:inline-flex"
            >
              <span aria-hidden="true" className="text-ink-600">
                ·
              </span>
              <span className="truncate">{context}</span>
            </span>
          ) : null}
        </div>

        {/* Desktop tabs + actions cluster. Hidden on mobile — the user
            navigates via MobileBottomNav instead. */}
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
            {/* Settings icon — Wave 10.4 moved Settings out of the main
                tab strip so the new Agents tab could fit without
                overflowing the 768 px header. Stays one click away via
                this cog button. */}
            <Link
              href="/app/settings"
              aria-label="Settings"
              data-testid="app-header-settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-ink-600 text-ink-300 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900"
            >
              <GearSix size={16} weight="bold" />
            </Link>
            <ThemeToggle />
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

        {/* Mobile-only right side: just the install button (renders
            nothing when not installable). Sign-out has moved to the
            bottom of /app/settings. */}
        <div className="flex items-center gap-2 sm:hidden">
          <InstallAppButton />
        </div>
      </div>
    </header>
  );
}
