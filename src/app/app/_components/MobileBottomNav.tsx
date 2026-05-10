"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  House,
  ListBullets,
  Stack,
  UsersThree,
  GearSix,
} from "@phosphor-icons/react";

/**
 * Sticky mobile bottom navigation for /app/*.
 *
 * Five icon-+-label tiles across the bottom of the viewport. Pinned to
 * the screen bottom on mobile via `position: fixed` (defined in the
 * `.t2q-bottomnav-bar` utility in globals.css). Hidden at `sm:` and
 * above — desktop users get the top tab bar in <AppHeader />.
 *
 * Active state mirrors the desktop tabs — `aria-current="page"` triggers
 * brand-orange icon + label tint + a thin top accent bar (.t2q-bottomnav-tile
 * styles in globals.css).
 *
 * Designed to consume the iOS home-indicator safe area via
 * `padding-bottom: env(safe-area-inset-bottom)` so tiles stay tappable on
 * iPhones with rounded corners.
 *
 * The +88px bottom padding the page content needs to clear this nav is
 * applied on `/app/layout.tsx`, not here.
 */
const TILES: ReadonlyArray<{ href: string; label: string; icon: Icon }> = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/quotes", label: "Quotes", icon: ListBullets },
  { href: "/app/materials", label: "Materials", icon: Stack },
  { href: "/app/clients", label: "Clients", icon: UsersThree },
  { href: "/app/settings", label: "Settings", icon: GearSix },
];

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      data-testid="app-bottom-nav"
      aria-label="App navigation"
      className="t2q-bottomnav-bar sm:hidden"
    >
      {TILES.map(({ href, label, icon: IconCmp }) => {
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
              size={20}
              weight={active ? "fill" : "regular"}
              aria-hidden="true"
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
