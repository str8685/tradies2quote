"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Hammer,
  Lightning,
  PaintRoller,
  Receipt,
  Wrench,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Fixed bottom-left "social activity" widget that pops up periodically
 * with synthetic events ("Riki T. sent quote $3,420") to give the
 * landing page a bit of life. Hidden on mobile — the screen real estate
 * is too valuable.
 *
 * Ported from the Emergent landing-export bundle. lucide-react icons in
 * the source are swapped for @phosphor-icons/react equivalents to match
 * the rest of the app:
 *
 *   lucide Zap        -> phosphor Lightning
 *   lucide FileCheck  -> phosphor FileText
 *
 * Synthetic data only — never reads or writes real user data, never
 * touches the API. aria-hidden because it's purely decorative.
 */

const NAMES = [
  "Riki T.",
  "Macca",
  "James W.",
  "Sione",
  "Davo",
  "Tane",
  "Bluey",
  "Hemi",
  "Jase",
  "Kez",
];

const CITIES: Array<readonly [string, string]> = [
  ["Auckland", "NZ"],
  ["Brisbane", "AU"],
  ["Manchester", "UK"],
  ["Wellington", "NZ"],
  ["Sydney", "AU"],
  ["Toronto", "CA"],
  ["Christchurch", "NZ"],
  ["Perth", "AU"],
  ["Leeds", "UK"],
  ["Vancouver", "CA"],
  ["Austin", "US"],
  ["Hamilton", "NZ"],
];

type Action = {
  icon: Icon;
  verb: string;
  color: string;
};

const ACTIONS: Action[] = [
  { icon: FileText, verb: "sent quote", color: "text-brand" },
  { icon: Receipt, verb: "got paid", color: "text-hivis" },
  { icon: Lightning, verb: "quote accepted", color: "text-green-400" },
  { icon: Hammer, verb: "started job", color: "text-brand" },
  { icon: Wrench, verb: "sent invoice", color: "text-hivis" },
  { icon: PaintRoller, verb: "quote viewed", color: "text-brand" },
];

type Event = {
  id: string;
  name: string;
  city: string;
  country: string;
  action: Action;
  amount: string;
  ago: number;
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function formatAmount(): string {
  const v = 800 + Math.floor(Math.random() * 9000);
  return `$${v.toLocaleString()}`;
}

function formatAgo(s: number): string {
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function makeEvent(): Event {
  const [city, country] = pick(CITIES);
  const action = pick(ACTIONS);
  return {
    id: Math.random().toString(36).slice(2),
    name: pick(NAMES),
    city,
    country,
    action,
    amount: formatAmount(),
    ago: 1 + Math.floor(Math.random() * 50),
  };
}

export function LiveTicker() {
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    // Seed only on the client to avoid SSR/CSR drift on the random
    // values. The first event fires inside a 0-ms timer (not directly
    // in the effect body) to satisfy React 19's
    // `react-hooks/set-state-in-effect` rule — setState must sit
    // inside a subscribed callback, not the effect body itself.
    const seed = setTimeout(() => setEvent(makeEvent()), 0);
    const id = setInterval(() => setEvent(makeEvent()), 4200);
    return () => {
      clearTimeout(seed);
      clearInterval(id);
    };
  }, []);

  if (!event) return null;
  const Icon = event.action.icon;

  return (
    <div
      aria-hidden="true"
      data-testid="live-ticker"
      className="pointer-events-none fixed bottom-4 left-4 z-40 hidden items-center md:flex"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          className="pointer-events-auto flex items-center gap-3 rounded-sm border border-ink-600 bg-ink-900/95 px-4 py-2.5 backdrop-blur-md"
          style={{
            borderLeft: "3px solid #FF5F15",
            boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          }}
        >
          <div
            className={`relative grid h-7 w-7 place-items-center border border-ink-600 bg-ink-800 ${event.action.color}`}
          >
            <Icon size={14} weight="bold" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] leading-tight">
              <span className="truncate font-display uppercase tracking-tight text-white">
                {event.name}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300">
                {event.city} · {event.country}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className={event.action.color}>{event.action.verb}</span>
              <span className="text-ink-300">{event.amount}</span>
              <span className="text-ink-500">· {formatAgo(event.ago)}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
