import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="relative bg-ink-950 pt-20 pb-10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid md:grid-cols-5 gap-10 pt-8 border-t border-ink-700">
          <div className="md:col-span-2">
            {/* Wave 12.3 — new Tradies2Quote brand mark (horizontal
                lockup on a small white pill, matches the rest of the
                site). Replaces the old inline Site-Safe Badge. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-horizontal.png"
              alt="Tradies2Quote"
              width={380}
              height={100}
              className="block h-9 w-auto rounded-sm bg-white px-2 py-1"
            />
            <p className="mt-4 text-ink-400 text-sm max-w-sm">
              Voice in. Quote out. Built by a builder running STR8 Builders in New Zealand.
            </p>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500 mb-3">
              Product
            </div>
            <ul className="space-y-2 text-ink-300 text-sm">
              <li>
                <a
                  href="#how"
                  data-testid="footer-link-how"
                  className="hover:text-white"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  data-testid="footer-link-features"
                  className="hover:text-white"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  data-testid="footer-link-pricing"
                  className="hover:text-white"
                >
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500 mb-3">
              Account
            </div>
            <ul className="space-y-2 text-ink-300 text-sm">
              <li>
                <Link
                  href="/login"
                  data-testid="footer-link-sign-in"
                  className="hover:text-white"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  data-testid="footer-link-start-trial"
                  className="hover:text-white"
                >
                  Start trial
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500 mb-3">
              Legal
            </div>
            <ul className="space-y-2 text-ink-300 text-sm">
              <li>
                <Link
                  href="/privacy"
                  data-testid="footer-link-privacy"
                  className="hover:text-white"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  data-testid="footer-link-terms"
                  className="hover:text-white"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  data-testid="footer-link-support"
                  className="hover:text-white"
                >
                  Support
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${LEGAL.supportEmail}`}
                  data-testid="footer-link-contact"
                  className="hover:text-white"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-ink-800 grid gap-3 text-xs font-mono uppercase tracking-[0.18em] text-ink-500">
          <div className="flex flex-col md:flex-row gap-3 justify-between">
            <span>© {new Date().getFullYear()} tradies2Quote · Built in NZ</span>
            <span>Voice in. Quote out. Under 60 sec.</span>
          </div>
          <div
            data-testid="footer-operator"
            className="text-[10px] tracking-[0.2em] text-ink-500/80 normal-case"
          >
            Operated by {LEGAL.companyName}
            {LEGAL.nzbn ? <> (NZBN {LEGAL.nzbn})</> : null}, {LEGAL.address}.
          </div>
        </div>
      </div>
    </footer>
  );
}
