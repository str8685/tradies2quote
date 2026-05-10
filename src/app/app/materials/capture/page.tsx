import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaptureForm } from "./_components/CaptureForm";
import { cleanSharedTitle, supplierFromUrl } from "./_lib/supplier-from-url";

export const metadata: Metadata = {
  title: "Capture from supplier",
};

export const dynamic = "force-dynamic";

/**
 * /app/materials/capture — supplier product capture landing page.
 *
 * Two arrival modes feed the same form:
 *
 * 1. Web Share Target (Android Chrome, desktop Chrome PWA installs):
 *    The OS hands us `?title=&text=&url=` after the user shares a supplier
 *    product page from their browser. We pre-fill the form with whatever
 *    arrived — no fetch, no DOM scraping, no calls to the supplier site.
 *
 * 2. Direct navigation / iPhone fallback:
 *    No params arrive. The form's URL field starts empty and the page
 *    surfaces a "paste flow" hint banner. iOS Safari does not implement
 *    Web Share Target, so iPhone tradies use this path.
 *
 * Either way, the only auto-derived value is the supplier name (extracted
 * from the URL hostname via `supplierFromUrl`). The tradie types/confirms
 * everything else and clicks "Add to materials" — which uses the existing
 * `createMaterial` server action without any new write paths.
 */
export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{
    title?: string;
    text?: string;
    url?: string;
    supplier?: string;
  }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Some share-sheet integrations stuff the URL into `text` rather than `url`.
  // Prefer the explicit url param; fall back to text when it looks URL-shaped.
  const sharedUrl =
    sp.url ?? (sp.text && /^https?:\/\//i.test(sp.text) ? sp.text : "");

  const detectedSupplier = sharedUrl ? supplierFromUrl(sharedUrl) : null;
  const initialSupplier = sp.supplier ?? detectedSupplier ?? "";
  const initialName = cleanSharedTitle(sp.title ?? "");

  // True if no useful share data arrived — surfaces the "paste flow" hint.
  const isPasteFallback = !sharedUrl;

  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <header className="border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex h-14 w-full max-w-[720px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/app/materials"
            data-testid="capture-back"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            ← Materials
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
            Supplier capture
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="t2q-section-label mb-3">{"// from your supplier"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Capture <span className="text-brand">product.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Paste or share a Mitre 10, Bunnings, ITM, or PlaceMakers product URL.
            Confirm the price and save it to your library — your quotes will use
            it instead of AI estimates.
          </p>
        </div>

        <CaptureForm
          initialUrl={sharedUrl}
          initialName={initialName}
          initialSupplier={initialSupplier}
          isPasteFallback={isPasteFallback}
        />
      </main>
    </div>
  );
}
