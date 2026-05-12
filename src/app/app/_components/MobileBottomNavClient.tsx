"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  House,
  ListBullets,
  Robot,
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

export function MobileBottomNavClient({ isOwner, userEmail, avatarUrl }: Props) {
  const pathname = usePathname() ?? "";
  // Wave 15.3 — memoised so re-renders triggered by sheetOpen state
  // don't recompute the tile list or the avatar initial. Cheap but
  // tightens the nav's render path on every tab interaction.
  const visibleTiles = useMemo(
    () => TILES.filter((t) => isOwner || !t.ownerOnly),
    [isOwner],
  );
  const initial = useMemo(
    () => (userEmail ?? "?").trim().charAt(0).toUpperCase() || "?",
    [userEmail],
  );
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
              // Wave 15.3 — explicit prefetch so the next tab's JS is
              // warmed as soon as the nav renders. Next 16's default
              // `null` only prefetches loading.tsx + the first level,
              // which is why mobile tap → render felt sluggish.
              prefetch={true}
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

        {/* Avatar tile. Tappable; opens the slide-up account hub
            sheet. Shows the avatar image when uploaded, otherwise
            the first letter of the user's email. */}
        <button
          type="button"
          data-testid="app-bottom-nav-me"
          aria-label="Account menu"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          className="t2q-bottomnav-tile cursor-pointer"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              // Wave 15.3 — bumped from h-7 (28px) → h-9 (36px) for
              // bigger thumb target + a more "this is me" feel.
              className="inline-block h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-ink-900 font-display text-sm leading-none"
            >
              {initial}
            </span>
          )}
          <span>Me</span>
        </button>
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
