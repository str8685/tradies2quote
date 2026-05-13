"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

// Wave 12.3 — InstallPWAButton removed from the landing top bar.
// The floating Install pill at <FloatingInstallButton /> (mounted in
// src/app/layout.tsx) carries this CTA across the whole site now.

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="site-header"
      // Wave 14.1 — pt-[env(safe-area-inset-top)] paints the header
      // bg up under the iPhone notch / Android camera cutout so the
      // landing feels edge-to-edge. The inner h-16 row stays below
      // the inset so the logo and nav links never get clipped.
      className={`sticky top-0 z-50 border-b border-ink-600 bg-ink-950 pt-[env(safe-area-inset-top)] transition-shadow ${
        scrolled ? "shadow-[0_1px_0_0_#FF5F15]" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link
          href="/"
          data-testid="nav-logo"
          className="group inline-flex items-center text-white"
          aria-label="tradies2Quote home"
        >
          {/* Wave 19.4 — replaced the PNG-in-a-white-pill with the
              first-class <Logo /> SVG mark. Wave 19.8 — swapped the
              caution-tape SVG for the new T2Q wordmark. Wave 19.9 —
              wordmark hides on mobile so the burger menu has room
              to breathe; T2Q alone reads as the brand on a phone
              and TRADIES2QUOTE rejoins it on tablet/desktop. */}
          <Logo size={36} wordmarkClassName="hidden md:inline" />
        </Link>

        <nav className="hidden md:flex items-center gap-8" data-testid="nav-primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-testid={`nav-link-${l.href.replace("#", "")}`}
              className="text-sm font-medium text-ink-300 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            data-testid="nav-sign-in"
            className="text-sm font-semibold text-ink-300 hover:text-white px-3"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            data-testid="nav-start-free"
            className="inline-flex items-center h-10 px-4 bg-brand text-ink-900 font-display text-sm tracking-tight uppercase rounded-sm hover:bg-hivis transition-colors"
          >
            Get beta access
          </Link>
        </div>

        <button
          className="md:hidden text-white"
          data-testid="nav-mobile-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label="menu"
        >
          {open ? (
            <X size={24} weight="bold" />
          ) : (
            <List size={24} weight="bold" />
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-ink-600 bg-ink-950">
          <div className="flex flex-col px-6 py-4 gap-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                data-testid={`nav-mobile-link-${l.href.replace("#", "")}`}
                onClick={() => setOpen(false)}
                className="py-3 text-base text-ink-200"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 pt-3 border-t border-ink-600">
              <Link
                href="/login"
                data-testid="nav-mobile-sign-in"
                className="flex-1 t2q-btn-ghost text-center"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                data-testid="nav-mobile-start-free"
                className="flex-1 t2q-btn-primary text-center"
                onClick={() => setOpen(false)}
              >
                Get beta access
              </Link>
            </div>
            {/* Install CTA moved to the floating bottom-right pill —
                see <FloatingInstallButton /> in src/app/layout.tsx. */}
          </div>
        </div>
      )}
    </header>
  );
}
