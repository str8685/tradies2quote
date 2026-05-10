import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MagnifyingGlass,
  Plus,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "../_components/AppHeader";

export const metadata: Metadata = {
  title: "Clients",
};

/**
 * /app/clients — UI-only client list shell.
 *
 * No application-table reads, no writes, no migrations, no new tables.
 * The only Supabase call is `auth.getUser()` for defense-in-depth on top
 * of the existing `proxy.ts` gate — same pattern every other /app/* page
 * already uses.
 *
 * The search input is presentational — there is no client list to filter
 * yet because nothing in the codebase reads the `clients` table. Clients
 * will become first-class records once a future wave wires "save client
 * on quote sent / accepted" into the quote flow.
 *
 * For now: empty state + CTA to start a quote. No fake/mocked client
 * data is rendered.
 */
export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen text-white">
      <AppHeader context="Clients" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label mb-3">{"// your client list"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Clients.
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Everyone you&apos;ve quoted, billed, or chased. Your address book
            lives here once your first quote goes out.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block flex-1 max-w-md">
            <span className="sr-only">Search clients</span>
            <MagnifyingGlass
              size={16}
              weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
            <input
              type="search"
              placeholder="Search by name, email, address…"
              data-testid="clients-search"
              className="w-full h-11 pl-9 pr-3 bg-ink-800 border border-ink-600 focus:border-brand focus:outline-none text-white placeholder:text-ink-500 rounded-sm"
              // Presentational only — no filter is wired because there is
              // no client list yet. See file header.
            />
          </label>
          <Link
            href="/app/quotes/new"
            data-testid="clients-new-quote"
            className="t2q-btn-primary"
          >
            <Plus size={18} weight="bold" />
            New quote
          </Link>
        </div>

        <div
          data-testid="clients-empty-state"
          className="t2q-premium-card-static mt-10 px-8 py-16 text-center"
        >
          <UsersThree
            size={48}
            weight="bold"
            className="mx-auto text-ink-500"
          />
          <h2 className="mt-6 font-display text-2xl uppercase tracking-tight text-white">
            No clients yet.
          </h2>
          <p className="mt-3 mx-auto max-w-md text-sm text-ink-300 leading-relaxed">
            They&apos;ll show up here automatically when you send your first
            quote — same name, same address, never re-keyed.
          </p>
          <Link
            href="/app/quotes/new"
            data-testid="clients-empty-cta"
            className="t2q-btn-primary mt-8"
          >
            <Plus size={18} weight="bold" />
            Start your first quote
          </Link>
        </div>
      </main>
    </div>
  );
}
