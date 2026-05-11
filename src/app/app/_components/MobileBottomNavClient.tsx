"use client";

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
 * Client part of the mobile bottom nav.
 *
 * Wave 13 — `isOwner` is now plumbed in from the server wrapper so the
 * Agents tile can be hidden from non-owner tradies. Owner sees the
 * full 4-tile bar; non-owner sees a 3-tile bar (Home, Quotes,
 * Materials). The whole nav is hidden on `sm:` and above; desktop
 * users get the top tab strip via `AppHeader`.
 */
interface Props {
  isOwner: boolean;
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
  // Wave 13: Agents tile is owner-only. Was visible to every tradie
  // in Wave 10.4; now hidden from non-owners.
  { href: "/app/agents", label: "Agents", icon: Robot, ownerOnly: true },
];

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavClient({ isOwner }: Props) {
  const pathname = usePathname() ?? "";
  const visibleTiles = TILES.filter((t) => isOwner || !t.ownerOnly);

  return (
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
