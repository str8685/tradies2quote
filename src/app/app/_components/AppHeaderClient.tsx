"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearSix, SignOut } from "@phosphor-icons/react";
import { ThemeToggle } from "@/app/_components/landing/ThemeToggle";
import { signOutAction } from "../actions";

/**
 * Client part of the shared `/app/*` header. Owns the active-tab
 * indicator (needs `usePathname()`) and the tab list. The server
 * wrapper at `AppHeader.tsx` fetches `isOwner` and passes it in so
 * owner-only tabs can be filtered out for everyone else.
 *
 * Wave 13 — the "Agents" tab is now `ownerOnly: true`. Non-owner
 * tradies see a 4-tab strip (Dashboard, Quotes, Materials, Clients).
 * The owner sees the full 5-tab strip including Agents.
 */
interface Props {
  context?: string;
  isOwner: boolean;
}

const TABS = [
  { href: "/app", label: "Dashboard", ownerOnly: false },
  { href: "/app/quotes", label: "Quotes", ownerOnly: false },
  { href: "/app/materials", label: "Materials", ownerOnly: false },
  // Wave 13: Agents tab is owner-only. Was visible to every tradie in
  // Wave 10.4; now hidden from non-owners.
  { href: "/app/agents", label: "Agents", ownerOnly: true },
  { href: "/app/clients", label: "Clients", ownerOnly: false },
] as const;

function isActiveTab(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeaderClient({ context, isOwner }: Props) {
  const pathname = usePathname() ?? "";
  const visibleTabs = TABS.filter((t) => isOwner || !t.ownerOnly);

  return (
    <header
      data-testid="app-header"
      data-is-owner={isOwner ? "true" : "false"}
      className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 sm:bg-ink-950/85 sm:backdrop-blur"
    >
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16 sm:max-w-5xl sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app"
            data-testid="app-header-home"
            aria-label="Tradies2Quote dashboard"
            className="inline-flex shrink-0 items-center"
          >
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

        <div className="hidden items-center gap-2 sm:flex">
          <nav
            data-testid="app-header-tabs"
            aria-label="Primary"
            className="flex items-center gap-1"
          >
            {visibleTabs.map((tab) => {
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
            <Link
              href="/app/settings"
              aria-label="Settings"
              data-testid="app-header-settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-ink-600 text-ink-300 transition-colors hover:border-brand hover:bg-brand hover:text-ink-900"
            >
              <GearSix size={16} weight="bold" />
            </Link>
            <ThemeToggle />
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
      </div>
    </header>
  );
}
