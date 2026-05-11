"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  Bug,
  GearSix,
  House,
  ListBullets,
  Robot,
  SignOut,
  Stack,
  UsersThree,
  X,
} from "@phosphor-icons/react";

/**
 * Client part of the mobile bottom nav.
 *
 * Wave 13 — `isOwner` is plumbed in from the server wrapper so the
 * Agents tile is hidden from non-owner tradies.
 *
 * Wave 14.4 — added an Avatar tile (rightmost) that opens a slide-up
 * sheet with Settings + Clients + Sign out. The avatar shows the
 * user's email initial in a brand-orange circle as a placeholder;
 * a follow-up commit will wire image upload.
 */
interface Props {
  isOwner: boolean;
  userEmail: string | null;
}

const TILES: ReadonlyArray<{
  href: string;
  label: string;
  icon: Icon;
  ownerOnly: boolean;
}> = [
  { href: "/app", label: "Home", icon: House, ownerOnly: false },
  { href: "/app/quotes", label: "Quotes", icon: ListBullets, ownerOnly: false },
  { href: "/app/materials", label: "Materials", icon: Stack, ownerOnly: false },
  // Wave 13: Agents owner-only.
  { href: "/app/agents", label: "Agents", icon: Robot, ownerOnly: true },
];

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavClient({ isOwner, userEmail }: Props) {
  const pathname = usePathname() ?? "";
  const visibleTiles = TILES.filter((t) => isOwner || !t.ownerOnly);
  const initial = (userEmail ?? "?").trim().charAt(0).toUpperCase() || "?";
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <nav
        data-testid="app-bottom-nav"
        data-is-owner={isOwner ? "true" : "false"}
        aria-label="App navigation"
        className="t2q-bottomnav-bar sm:hidden"
      >
        {visibleTiles.map(({ href, label, icon: IconCmp }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className="t2q-bottomnav-tile"
              aria-current={active ? "page" : undefined}
              data-testid={`app-bottom-nav-${label.toLowerCase()}`}
            >
              <IconCmp
                size={22}
                weight={active ? "fill" : "regular"}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Wave 14.4 — Avatar tile. Tappable; opens the slide-up
            account sheet (Settings / Clients / Sign out). */}
        <button
          type="button"
          data-testid="app-bottom-nav-me"
          aria-label="Account menu"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          className="t2q-bottomnav-tile cursor-pointer"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-ink-900 font-display text-xs leading-none"
          >
            {initial}
          </span>
          <span>Me</span>
        </button>
      </nav>

      {sheetOpen ? (
        <div
          data-testid="account-sheet"
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:hidden"
          onClick={() => setSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl border-t border-ink-700 bg-ink-950 p-5 pb-[calc(env(safe-area-inset-bottom,0)+1.25rem)]"
            role="dialog"
            aria-labelledby="account-sheet-heading"
          >
            <header className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-ink-900 font-display text-base"
                >
                  {initial}
                </span>
                <div className="min-w-0">
                  <p
                    id="account-sheet-heading"
                    className="font-display text-sm uppercase tracking-tight text-white"
                  >
                    Account
                  </p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                    {userEmail ?? "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-ink-700 text-ink-300 hover:border-brand hover:text-brand"
              >
                <X size={14} weight="bold" />
              </button>
            </header>

            <ul className="space-y-2">
              <li>
                <Link
                  href="/app/settings"
                  data-testid="account-sheet-settings"
                  onClick={() => setSheetOpen(false)}
                  className="flex items-center gap-3 rounded-sm border border-ink-700 bg-ink-900/60 px-4 py-3 hover:border-brand hover:bg-brand/5"
                >
                  <GearSix
                    size={16}
                    weight="bold"
                    className="text-brand"
                    aria-hidden="true"
                  />
                  <span className="font-display text-sm uppercase tracking-tight text-white">
                    Settings
                  </span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                    Business + defaults
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/app/clients"
                  data-testid="account-sheet-clients"
                  onClick={() => setSheetOpen(false)}
                  className="flex items-center gap-3 rounded-sm border border-ink-700 bg-ink-900/60 px-4 py-3 hover:border-brand hover:bg-brand/5"
                >
                  <UsersThree
                    size={16}
                    weight="bold"
                    className="text-brand"
                    aria-hidden="true"
                  />
                  <span className="font-display text-sm uppercase tracking-tight text-white">
                    Clients
                  </span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                    Saved contacts
                  </span>
                </Link>
              </li>
              {/* Wave 14.5 — Debug moved into the account sheet for
                  owners. Was a separate tail-nav block on the
                  dashboard, but the avatar sheet is the right home
                  for owner-only nav. Non-owners never see this. */}
              {isOwner ? (
                <li>
                  <Link
                    href="/app/debug"
                    data-testid="account-sheet-debug"
                    onClick={() => setSheetOpen(false)}
                    className="flex items-center gap-3 rounded-sm border border-ink-700 bg-ink-900/60 px-4 py-3 hover:border-brand hover:bg-brand/5"
                  >
                    <Bug
                      size={16}
                      weight="bold"
                      className="text-brand"
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm uppercase tracking-tight text-white">
                      Debug
                    </span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                      Owner only
                    </span>
                  </Link>
                </li>
              ) : null}
              <li>
                <form action="/auth/signout" method="POST">
                  <button
                    type="submit"
                    data-testid="account-sheet-sign-out"
                    className="flex w-full items-center gap-3 rounded-sm border border-red-500/40 bg-red-500/5 px-4 py-3 text-left hover:border-red-500/70 hover:bg-red-500/10"
                  >
                    <SignOut
                      size={16}
                      weight="bold"
                      className="text-red-300"
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm uppercase tracking-tight text-red-200">
                      Sign out
                    </span>
                  </button>
                </form>
              </li>
            </ul>

            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-400">
              {"// avatar image upload lands in a follow-up wave."}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
