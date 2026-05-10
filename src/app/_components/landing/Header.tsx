"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import InstallPWAButton from "./InstallPWAButton";

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
      className={`sticky top-0 z-50 border-b border-ink-600 bg-ink-950 transition-shadow ${
        scrolled ? "shadow-[0_1px_0_0_#FF5F15]" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link
          href="/"
          data-testid="nav-logo"
          className="group"
          aria-label="tradies2Quote home"
        >
          <Logo size={34} />
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
          <InstallPWAButton variant="nav" />
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
            Start free
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
                className="py-2 text-base text-ink-200"
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
                Start free
              </Link>
            </div>
            <div className="pt-2">
              <InstallPWAButton variant="nav" className="w-full justify-center" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
