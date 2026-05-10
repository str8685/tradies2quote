import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle, Plus, Upload } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { NZ_DEFAULTS } from "@/lib/quote-defaults";
import type { LibraryMaterial } from "@/lib/quote-types";
import { SupplierShortcuts } from "./_components/SupplierShortcuts";
import { MaterialsList } from "./_components/MaterialsList";

export const metadata: Metadata = {
  title: "Materials library",
};

export default async function MaterialsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("materials")
    .select(
      "id, name, unit, default_unit_price, supplier, supplier_url, notes, usage_count, is_ai_estimated, last_used_at",
    )
    .eq("user_id", user.id)
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("currency")
    .eq("id", user.id)
    .maybeSingle();

  const currency = profile?.currency ?? NZ_DEFAULTS.currency;

  const materials: LibraryMaterial[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    default_unit_price:
      r.default_unit_price !== null ? Number(r.default_unit_price) : null,
    supplier: r.supplier,
    supplier_url: r.supplier_url,
    notes: r.notes,
    usage_count: Number(r.usage_count) || 0,
    is_ai_estimated: !!r.is_ai_estimated,
    last_used_at: r.last_used_at,
  }));

  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <header className="border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app"
            data-testid="materials-back"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
          >
            ← Dashboard
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
            Materials
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-4">
          <div className="t2q-section-label mb-3">{"// your library"}</div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Materials <span className="text-brand">library.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-300 sm:text-base">
            Save your common materials with prices. Quotes will use these instead of AI estimates.
          </p>
        </div>

        <CaptureSuccessBanner />

        <section
          data-testid="materials-capture-nudge"
          className="mt-6 rounded-sm border border-ink-700 bg-ink-800/60 p-4 sm:p-5"
          aria-labelledby="materials-capture-nudge-title"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
            {"// supplier capture"}
          </div>
          <h2
            id="materials-capture-nudge-title"
            className="mt-2 font-display text-lg uppercase tracking-tight text-white sm:text-xl"
          >
            Supplier capture.
          </h2>
          <p className="mt-2 text-sm text-ink-300">
            Share or paste supplier products into your materials list.
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Android PWA users can share supplier pages into Tradies2Quote.
            iPhone users can paste the product URL.
          </p>
          <div className="mt-4">
            <Link
              href="/app/materials/capture"
              data-testid="materials-capture-link"
              className="t2q-btn-primary inline-flex h-11 px-5"
            >
              <Plus size={18} weight="bold" />
              Capture supplier product
            </Link>
          </div>
        </section>

        <SupplierShortcuts />

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            data-testid="materials-count"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500"
          >
            {`// ${materials.length} item${materials.length === 1 ? "" : "s"} saved`}
          </p>
          <div className="flex gap-2">
            <Link
              href="/app/materials/import"
              data-testid="materials-import-link"
              className="t2q-btn-ghost"
            >
              <Upload size={18} weight="bold" />
              Import CSV
            </Link>
            <Link
              href="/app/materials/new"
              data-testid="materials-add-link"
              className="t2q-btn-primary"
            >
              <Plus size={18} weight="bold" />
              Add material
            </Link>
          </div>
        </div>

        <MaterialsList materials={materials} currency={currency} />
      </main>
    </div>
  );
}

/**
 * Server component shown only when the user just landed back on
 * /app/materials from the supplier-capture flow. Detects the immediate
 * referrer; if it ends with /app/materials/capture, the new material has
 * just been saved and we show a green success banner with a "Capture
 * another" link. On any subsequent visit (refresh, navigation from
 * elsewhere) the banner disappears — referer changes / clears.
 *
 * No new state, no cookies, no DB read. Pure server-rendered banner
 * that re-uses information the request already carries.
 */
async function CaptureSuccessBanner() {
  const h = await headers();
  const referer = h.get("referer") ?? "";
  let cameFromCapture = false;
  try {
    const path = new URL(referer).pathname;
    cameFromCapture = path === "/app/materials/capture";
  } catch {
    // Malformed or missing referer — banner stays hidden.
  }
  if (!cameFromCapture) return null;

  return (
    <div
      role="status"
      data-testid="materials-capture-success"
      className="mt-6 flex flex-col gap-3 rounded-sm border border-brand/40 bg-brand/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <CheckCircle
          size={22}
          weight="fill"
          className="text-brand mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div>
          <p className="font-display text-sm uppercase tracking-tight text-white">
            Material added.
          </p>
          <p className="mt-0.5 text-xs text-ink-300">
            Your library now has one more item. Quotes will use it instead of
            an AI estimate.
          </p>
        </div>
      </div>
      <Link
        href="/app/materials/capture"
        data-testid="materials-capture-success-again"
        className="inline-flex h-9 items-center gap-2 self-start rounded-sm border border-brand bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-brand transition-colors hover:bg-brand hover:text-ink-900 sm:self-auto"
      >
        <Plus size={14} weight="bold" />
        Capture another
      </Link>
    </div>
  );
}
