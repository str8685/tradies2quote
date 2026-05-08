import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "./_components/ImportClient";

export const metadata: Metadata = {
  title: "Import materials",
};

export default async function ImportMaterialsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <header className="border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app/materials"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            ← Library
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
            Import CSV
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label mb-3">{"// bulk import"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Import <span className="text-brand">CSV.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Drop in a CSV from your spreadsheet. We&apos;ll match existing items by name and update prices, or add new ones.
          </p>
        </div>

        <ImportClient />
      </main>
    </div>
  );
}
