import Link from "next/link";
import { Microphone } from "@phosphor-icons/react/dist/ssr";

export function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="relative bg-ink-950 pt-20 pb-10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid md:grid-cols-4 gap-10 pt-8 border-t border-ink-700">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-brand grid place-items-center rounded-sm border-2 border-brand-700">
                <Microphone size={16} weight="bold" className="text-ink-900" />
              </div>
              <span className="font-display text-lg uppercase tracking-tight">
                tradies<span className="text-brand">2</span>Quote
              </span>
            </div>
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
        </div>

        <div className="mt-12 pt-6 border-t border-ink-800 flex flex-col md:flex-row gap-3 justify-between text-xs font-mono uppercase tracking-[0.18em] text-ink-500">
          <span>© {new Date().getFullYear()} tradies2Quote · Built in NZ</span>
          <span>Voice in. Quote out. Under 60 sec.</span>
        </div>
      </div>
    </footer>
  );
}
