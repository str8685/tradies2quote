"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  AddressBook,
  CaretRight,
  GearSix,
  House,
  List,
  ListBullets,
  Plus,
  Receipt,
  Robot,
  Stack,
  UserCircle,
  X,
} from "@phosphor-icons/react";

/**
 * Wave 17 — perf — `AccountHub` is the heaviest client component
 * dependency of the mobile nav (~520 lines + 11 icons + server-action
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
 * Client part of the mobile navigation.
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
 *
 * Wave 43 — mobile navigation moved out of the bottom bar and into a
 * top-left round menu button. The /app shell remains scroll-locked
 * (Wave 37), but there is no fixed bottom bar competing with the
 * home-indicator area anymore.
 */
interface Props {
  isOwner: boolean;
  userEmail: string | null;
  /** Wave 15 — passed through so the sheet's avatar field can show the
   *  image when present and fall back to the initial when not. */
  avatarUrl: string | null;
}

const MENU_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: Icon;
  ownerOnly?: boolean;
  primary?: boolean;
  testId: string;
}> = [
  { href: "/app", label: "Home", icon: House, testId: "home" },
  {
    href: "/app/quotes/new",
    label: "New quote",
    icon: Plus,
    primary: true,
    testId: "new-quote",
  },
  { href: "/app/quotes", label: "Quotes", icon: ListBullets, testId: "quotes" },
  { href: "/app/invoices", label: "Invoices", icon: Receipt, testId: "invoices" },
  { href: "/app/materials", label: "Materials", icon: Stack, testId: "materials" },
  { href: "/app/clients", label: "Clients", icon: AddressBook, testId: "clients" },
  { href: "/app/settings", label: "Settings", icon: GearSix, testId: "settings" },
  {
    href: "/app/agents",
    label: "Agents",
    icon: Robot,
    ownerOnly: true,
    testId: "agents",
  },
];

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileAppMenuClient({ isOwner, userEmail, avatarUrl }: Props) {
  const pathname = usePathname() ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const visibleItems = MENU_ITEMS.filter((item) => isOwner || !item.ownerOnly);

  useEffect(() => {
    const t = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      {/* Mobile account shortcut. Navigation lives in the top-left menu;
          this stays top-right for profile, settings, clients, and sign out. */}
      <button
        type="button"
        data-testid="app-account-avatar"
        data-tour="account-menu"
        aria-label="Account menu"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className="t2q-account-avatar sm:hidden"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserCircle size={32} weight="fill" className="text-brand" aria-hidden="true" />
        )}
      </button>

      <button
        ref={menuButtonRef}
        type="button"
        data-testid="app-mobile-menu-trigger"
        data-tour="mobile-navigation"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="t2q-mobile-menu-trigger sm:hidden"
      >
        {menuOpen ? (
          <X size={24} weight="bold" aria-hidden="true" />
        ) : (
          <List size={26} weight="bold" aria-hidden="true" />
        )}
      </button>

      {menuOpen ? (
        <div
          ref={menuRef}
          data-testid="app-mobile-menu-panel"
          data-is-owner={isOwner ? "true" : "false"}
          role="menu"
          className="t2q-mobile-menu-panel sm:hidden"
        >
          <div className="t2q-mobile-menu-heading">
            <span>Menu</span>
            <span aria-hidden="true">T2Q</span>
          </div>
          <nav aria-label="App navigation" className="t2q-mobile-menu-list">
            {visibleItems.map(({ href, label, icon: IconCmp, primary, testId }) => {
              const active = isActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={true}
                  aria-current={active ? "page" : undefined}
                  data-primary={primary ? "true" : "false"}
                  data-testid={`app-mobile-menu-${testId}`}
                  role="menuitem"
                  className="t2q-mobile-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="t2q-mobile-menu-item-icon" aria-hidden="true">
                    <IconCmp size={22} weight={active || primary ? "fill" : "regular"} />
                  </span>
                  <span className="t2q-mobile-menu-item-label">{label}</span>
                  <CaretRight size={16} weight="bold" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            role="menuitem"
            className="t2q-mobile-menu-account"
            onClick={() => {
              setMenuOpen(false);
              setSheetOpen(true);
            }}
          >
            <UserCircle size={22} weight="fill" aria-hidden="true" />
            <span>Account hub</span>
            <CaretRight size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ) : null}

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
