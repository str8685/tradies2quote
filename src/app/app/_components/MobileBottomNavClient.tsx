"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  House,
  ListBullets,
  Plus,
  Receipt,
  Stack,
} from "@phosphor-icons/react";

/**
 * Wave 17 — perf — `AccountHub` is the heaviest client component
 * dependency of the bottom nav (~520 lines + 11 icons + server-action
 * client glue). Eagerly importing it bloated every /app/* page's
 * initial bundle, even though the sheet only opens when the user taps
 * the "Me" tile. Dynamic-importing with `ssr: false` splits it into
 * its own chunk that's only fetched on first tap. After the first
 * fetch, the chunk is browser-cached for the rest of the session, so
 * subsequent opens feel instant. `loading: () => null` keeps the
 * sheet's first-open transition clean — the backdrop already fades
 * in, and the body fills the moment the chunk lands.
 */
const AccountHub = dynamic(
  () => import("./AccountHub").then((m) => m.AccountHub),
  { ssr: false, loading: () => null },
);

/**
 * Client part of the mobile bottom nav.
 *
 * Wave 13 — `isOwner` is plumbed in from the server wrapper so the
 * Agents tile is hidden from non-owner tradies.
 *
 * Wave 14.4 — added an Avatar tile (rightmost) that opens a slide-up
 * sheet with Settings + Clients + Sign out.
 *
 * Wave 15 — sheet body extracted to `<AccountHub mode="sheet">`. The
 * sheet now carries Profile / Business / Quote defaults / Invoice
 * defaults / Clients / Avatar upload field + owner-only shortcuts
 * (Agents, Debug, Monitor dashboard). Non-owners never see those.
 */
interface Props {
  isOwner: boolean;
  userEmail: string | null;
  /** Wave 15 — passed through so the sheet's avatar field can show the
   *  image when present and fall back to the initial when not. */
  avatarUrl: string | null;
}

// 4-tabs-plus-centre-FAB layout:
//   [Home, Quotes]  ( New quote FAB )  [Invoices, Materials]
// The avatar/account "Me" tile moved OFF the bar to a floating top-right
// button (see the avatar trigger in the render below); Materials took its
// slot. Agents stays in the dashboard card for owners.
const LEFT_TILES: ReadonlyArray<{ href: string; label: string; icon: Icon }> = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/quotes", label: "Quotes", icon: ListBullets },
];
const RIGHT_TILES: ReadonlyArray<{ href: string; label: string; icon: Icon }> = [
  { href: "/app/invoices", label: "Invoices", icon: Receipt },
  { href: "/app/materials", label: "Materials", icon: Stack },
];

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavClient({ isOwner, userEmail, avatarUrl }: Props) {
  const pathname = usePathname() ?? "";
  const initial = useMemo(
    () => (userEmail ?? "?").trim().charAt(0).toUpperCase() || "?",
    [userEmail],
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  // Wave 15.3 — explicit prefetch so the next tab's JS is warmed as soon
  // as the nav renders. Next 16's default only prefetches the first level.
  const renderTile = ({
    href,
    label,
    icon: IconCmp,
  }: {
    href: string;
    label: string;
    icon: Icon;
  }) => {
    const active = isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        prefetch={true}
        className="t2q-bottomnav-tile"
        aria-current={active ? "page" : undefined}
        data-testid={`app-bottom-nav-${label.toLowerCase()}`}
      >
        <IconCmp size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Floating top-right avatar (mobile only). The account "Me" tile
          moved off the bottom bar to here; tapping it opens the same
          slide-up account hub sheet. Carries an "online" pulse ring +
          status dot. Fixed below the notch safe-area; sits above page
          content but under the open sheet (z-50). */}
      <button
        type="button"
        data-testid="app-mobile-avatar"
        aria-label="Account menu"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className="t2q-avatar-online fixed right-3 top-[calc(env(safe-area-inset-top)+0.6rem)] z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-950/80 shadow-lg backdrop-blur sm:hidden"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-ink-900 font-display text-sm leading-none"
          >
            {initial}
          </span>
        )}
      </button>

      <nav
        data-testid="app-bottom-nav"
        data-is-owner={isOwner ? "true" : "false"}
        aria-label="App navigation"
        className="t2q-bottomnav-bar sm:hidden"
      >
        {LEFT_TILES.map(renderTile)}

        {/* Centre FAB — primary "New quote" action, centred inline in the bar. */}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/app/quotes/new"
            prefetch={true}
            aria-label="New quote"
            data-testid="app-bottom-nav-new"
            className="t2q-bottomnav-fab"
          >
            <Plus size={26} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        {RIGHT_TILES.map(renderTile)}
      </nav>

      {sheetOpen ? (
        <div
          data-testid="account-sheet"
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:hidden"
          onClick={() => setSheetOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full">
            <AccountHub
              mode="sheet"
              isOwner={isOwner}
              userEmail={userEmail}
              avatarUrl={avatarUrl}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
