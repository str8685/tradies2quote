"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  ClipboardText,
  Plus,
  Spinner,
  Storefront,
  X,
} from "@phosphor-icons/react";
import { saveSupplierMaterial } from "../actions";
import { supplierFromUrl } from "../../materials/capture/_lib/supplier-from-url";

/**
 * Client-side in-app supplier browser.
 *
 * Layout (mobile-first):
 *   ┌─────────────────────────────────────────────┐
 *   │  Supplier shortcuts (Bunnings, ITM, …)      │
 *   │  URL bar  [          input          ] [Go]  │
 *   │  ┌─────────────────────────────────────┐    │
 *   │  │            <iframe>                 │    │
 *   │  └─────────────────────────────────────┘    │
 *   │                                             │
 *   │             ┌────────────────────────┐      │
 *   │             │ + Add to Materials     │  ◀── fixed bottom
 *   │             └────────────────────────┘      │
 *   └─────────────────────────────────────────────┘
 *
 * The URL bar is the source of truth — cross-origin iframes leak no
 * URL info to the parent, so the floating button uses the bar's value
 * for extraction, not the iframe's contentWindow.location.
 */

type Phase =
  | { state: "idle" }
  | { state: "extracting" }
  | {
      state: "review";
      product: { name: string; price: number; unit: string };
      sourceUrl: string;
      gstInclusive: boolean;
      saving: boolean;
      saveError: string | null;
    }
  | { state: "manual"; sourceUrl: string }
  | { state: "saved"; name: string }
  | { state: "error"; message: string };

const SUPPLIER_SHORTCUTS: ReadonlyArray<{
  name: string;
  url: string;
}> = [
  { name: "Placemakers", url: "https://www.placemakers.co.nz" },
  { name: "Bunnings", url: "https://www.bunnings.co.nz" },
  { name: "Mitre 10", url: "https://www.mitre10.co.nz" },
  { name: "Noel Leeming", url: "https://www.noelleeming.co.nz" },
  { name: "ITM", url: "https://www.itm.co.nz" },
];

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function SupplierBrowser({ initialUrl }: { initialUrl: string }) {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [loadedUrl, setLoadedUrl] = useState(initialUrl);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const detectedSupplier = useMemo(
    () => (loadedUrl ? supplierFromUrl(loadedUrl) : null),
    [loadedUrl],
  );

  const navigate = useCallback((url: string) => {
    const next = normaliseUrl(url);
    if (!next) return;
    setLoadedUrl(next);
    setInputUrl(next);
    setIframeLoaded(false);
    setIframeKey((k) => k + 1);
  }, []);

  // iOS Safari doesn't implement Web Share Target (so T2Q can't appear
  // in the iOS share sheet). The practical fallback: tradie taps "Open
  // in browser" → Safari opens supplier page → tradie Shares → Copy →
  // switches back here → hits this paste button. The Clipboard API is
  // supported on iOS Safari 13.1+ but requires a user gesture, so this
  // MUST be a click handler (not auto-detected).
  const [pasteError, setPasteError] = useState<string | null>(null);
  const handlePasteUrl = useCallback(async () => {
    setPasteError(null);
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) {
        setPasteError(
          "Clipboard is empty. Copy a supplier product link first, then come back.",
        );
        return;
      }
      if (!/^https?:\/\//i.test(trimmed)) {
        setPasteError(
          "That doesn't look like a URL. Copy a supplier product link first.",
        );
        return;
      }
      navigate(trimmed);
    } catch {
      setPasteError(
        "Couldn't read your clipboard. Paste the URL into the field below instead.",
      );
    }
  }, [navigate]);

  const onSubmitUrl = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  const reloadIframe = () => {
    setIframeLoaded(false);
    setIframeKey((k) => k + 1);
  };

  const onAddToMaterials = async () => {
    const url = normaliseUrl(inputUrl || loadedUrl);
    if (!url) {
      setPhase({
        state: "error",
        message: "Type a supplier product URL first.",
      });
      return;
    }
    setPhase({ state: "extracting" });
    try {
      const res = await fetch("/api/suppliers/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setPhase({
          state: "error",
          message: data?.error ?? "Extraction failed. Try again.",
        });
        return;
      }
      const data = (await res.json()) as {
        product: { name: string; price: number; unit: string } | null;
        url: string;
        fetched: boolean;
        reason?: string;
      };
      if (!data.product) {
        setPhase({ state: "manual", sourceUrl: data.url });
        return;
      }
      setPhase({
        state: "review",
        product: data.product,
        sourceUrl: data.url,
        gstInclusive: true,
        saving: false,
        saveError: null,
      });
    } catch {
      setPhase({
        state: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  };

  const closeSheet = () => setPhase({ state: "idle" });

  const onSave = async (override?: {
    name: string;
    unit: string;
    price: number;
    gstInclusive: boolean;
  }) => {
    if (phase.state !== "review") return;
    const final = override ?? {
      name: phase.product.name,
      unit: phase.product.unit,
      price: phase.product.price,
      gstInclusive: phase.gstInclusive,
    };
    const exGstPrice = final.gstInclusive
      ? Math.round((final.price / 1.15) * 100) / 100
      : Math.round(final.price * 100) / 100;
    setPhase({ ...phase, saving: true, saveError: null });
    const result = await saveSupplierMaterial({
      name: final.name,
      unit: final.unit,
      default_unit_price: exGstPrice,
      supplier: detectedSupplier ?? "",
      supplier_url: phase.sourceUrl,
      notes: "Imported via in-app supplier browser.",
    });
    if (!result.ok) {
      setPhase({ ...phase, saving: false, saveError: result.error });
      return;
    }
    setPhase({ state: "saved", name: final.name });
  };

  // Major NZ retailers (Placemakers, Bunnings, Mitre 10, ITM) set
  // X-Frame-Options: DENY, so the iframe loads but renders blank — and
  // iframeLoaded still flips true on the empty response. The earlier
  // condition only showed the "open in browser" escape BEFORE load
  // finished, which meant for blocked sites the hint disappeared the
  // moment it was actually needed. Now: whenever a URL is loaded, the
  // hint is available so the tradie always has a way out.
  const showBlockedHint = Boolean(loadedUrl);

  return (
    <main className="mx-auto w-full max-w-3xl px-3 pb-32 pt-4 sm:px-6 sm:pt-8">
      <div className="mb-3 flex flex-col gap-1 sm:mb-4">
        <div className="t2q-section-label">{"// in-app supplier browser"}</div>
        <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
          Browse & <span className="text-brand">import.</span>
        </h1>
        <p className="text-sm text-ink-300">
          Browse a supplier, tap{" "}
          <span className="font-mono text-brand">+ Add to Materials</span> on a
          product page, and we&apos;ll pull the name and price for you.
        </p>
      </div>

      <div className="mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
          {"// shortcuts"}
        </p>
        <div className="mt-2 -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {SUPPLIER_SHORTCUTS.map((s) => {
            const active = loadedUrl.startsWith(s.url);
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => navigate(s.url)}
                data-testid={`supplier-shortcut-${s.name.toLowerCase().replace(/\s+/g, "-")}`}
                aria-pressed={active}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-3 py-2 font-display text-[11px] uppercase tracking-tight transition-colors sm:text-xs",
                  active
                    ? "border-brand bg-brand text-ink-900"
                    : "border-ink-700 bg-ink-800 text-white hover:border-brand",
                ].join(" ")}
              >
                <Storefront size={14} weight="bold" aria-hidden="true" />
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Paste-from-clipboard CTA. Lives just above the URL bar so the
          two paths (paste vs type) sit side-by-side. Primary action for
          iOS users coming back from Safari with a copied product URL. */}
      <div className="mb-3">
        <button
          type="button"
          onClick={handlePasteUrl}
          data-testid="supplier-paste-clipboard"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-brand/50 bg-brand/5 px-4 font-display text-xs uppercase tracking-tight text-brand transition-colors hover:border-brand hover:bg-brand/10 sm:w-auto sm:text-sm"
        >
          <ClipboardText size={16} weight="bold" />
          Paste URL from clipboard
        </button>
        {pasteError && (
          <p
            role="alert"
            data-testid="supplier-paste-error"
            className="mt-2 text-xs text-red-300"
          >
            {pasteError}
          </p>
        )}
      </div>

      <form
        onSubmit={onSubmitUrl}
        className="flex items-stretch gap-2"
        data-testid="supplier-url-form"
      >
        <input
          type="url"
          inputMode="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://www.mitre10.co.nz/shop/…"
          data-testid="supplier-url-input"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 h-11 rounded-sm border border-ink-600 bg-ink-900 px-3 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand"
        />
        <button
          type="submit"
          data-testid="supplier-url-go"
          className="t2q-btn-primary h-11 px-4 text-xs sm:text-sm"
        >
          Go
        </button>
        {loadedUrl && (
          <button
            type="button"
            onClick={reloadIframe}
            aria-label="Reload"
            data-testid="supplier-url-reload"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-ink-700 bg-ink-800 text-ink-200 transition-colors hover:border-brand hover:text-brand"
          >
            <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
          </button>
        )}
      </form>

      <div className="mt-3 overflow-hidden rounded-sm border border-ink-700 bg-ink-950">
        {loadedUrl ? (
          <div className="relative">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={loadedUrl}
              title="Supplier site"
              data-testid="supplier-iframe"
              onLoad={() => setIframeLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className="block h-[60vh] w-full bg-white sm:h-[65vh]"
            />
            {showBlockedHint && (
              <div
                role="status"
                data-testid="supplier-blocked-hint"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-ink-950/95 px-3 py-2 text-center text-[11px] text-ink-300"
              >
                <span className="pointer-events-auto">
                  Page blank or won&apos;t load?{" "}
                  <a
                    href={loadedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono uppercase tracking-[0.2em] text-brand underline decoration-dotted"
                  >
                    Open in browser
                    <ArrowSquareOut
                      size={11}
                      weight="bold"
                      className="ml-1 inline-block"
                      aria-hidden="true"
                    />
                  </a>{" "}
                  — many supplier sites block in-app browsing. Paste the
                  product URL back here, then tap +.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            data-testid="supplier-empty"
            className="grid h-[40vh] place-items-center px-6 text-center text-ink-300"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                {"// no site loaded"}
              </div>
              <p className="mt-2 text-sm">
                Pick a supplier above or paste a product URL to start.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* "Add to Materials" bar sits ABOVE the mobile bottom nav. The
          nav is a fixed 57px strip (plus safe-area inset) at z-40, so
          this bar mirrors the StickyActionBar pattern: bottom-offset
          accounts for the nav, z-index sits above it. Without this the
          button was hidden behind the nav and unreachable. */}
      <div
        className="fixed inset-x-0 z-50 px-4 pt-3 sm:px-6 bottom-[calc(57px_+_max(env(safe-area-inset-bottom)_-_24px,4px))] sm:bottom-0 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        style={{
          background:
            "linear-gradient(to top, rgba(10,10,10,0.95) 50%, rgba(10,10,10,0))",
        }}
      >
        <div className="mx-auto flex max-w-md justify-center">
          <button
            type="button"
            onClick={onAddToMaterials}
            disabled={phase.state === "extracting"}
            data-testid="supplier-add-btn"
            className="t2q-btn-primary t2q-shadow-brutal h-14 w-full max-w-sm justify-center text-base disabled:cursor-not-allowed disabled:opacity-70"
          >
            {phase.state === "extracting" ? (
              <>
                <Spinner
                  size={20}
                  weight="bold"
                  className="animate-spin"
                  aria-hidden="true"
                />
                Reading product…
              </>
            ) : (
              <>
                <Plus size={20} weight="bold" aria-hidden="true" />
                Add to Materials
              </>
            )}
          </button>
        </div>
      </div>

      {phase.state === "review" && (
        <ReviewSheet
          phase={phase}
          onCancel={closeSheet}
          onSave={onSave}
          supplierName={detectedSupplier ?? null}
          onUpdate={(patch) =>
            setPhase((p) => (p.state === "review" ? { ...p, ...patch } : p))
          }
        />
      )}

      {phase.state === "manual" && (
        <ManualFallbackSheet
          sourceUrl={phase.sourceUrl}
          onCancel={closeSheet}
        />
      )}

      {phase.state === "saved" && (
        <SavedToast name={phase.name} onDismiss={closeSheet} />
      )}

      {phase.state === "error" && (
        <ErrorToast message={phase.message} onDismiss={closeSheet} />
      )}
    </main>
  );
}

function ReviewSheet({
  phase,
  onCancel,
  onSave,
  onUpdate,
  supplierName,
}: {
  phase: Extract<Phase, { state: "review" }>;
  onCancel: () => void;
  onSave: (override?: {
    name: string;
    unit: string;
    price: number;
    gstInclusive: boolean;
  }) => Promise<void>;
  onUpdate: (patch: Partial<Extract<Phase, { state: "review" }>>) => void;
  supplierName: string | null;
}) {
  const [name, setName] = useState(phase.product.name);
  const [unit, setUnit] = useState(phase.product.unit);
  const [price, setPrice] = useState(String(phase.product.price));
  const priceNum = Number(price);
  const validPrice = Number.isFinite(priceNum) && priceNum >= 0;
  const exGst = validPrice
    ? phase.gstInclusive
      ? Math.round((priceNum / 1.15) * 100) / 100
      : Math.round(priceNum * 100) / 100
    : null;
  const canSave =
    !phase.saving && name.trim().length > 0 && unit.trim().length > 0 && validPrice;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-review-title"
      data-testid="supplier-review-sheet"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="t2q-card w-full max-w-md rounded-b-none p-5 sm:rounded-sm sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
              {"// review and save"}
            </div>
            <h2
              id="supplier-review-title"
              className="mt-1 font-display text-lg uppercase tracking-tight sm:text-xl"
            >
              Save this product?
            </h2>
            {supplierName && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
                {supplierName}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-500 hover:text-white"
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <SheetField label="Product name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="supplier-review-name"
              className="block w-full h-11 rounded-sm border border-ink-600 bg-ink-900 px-3 text-white outline-none focus:border-brand"
            />
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Unit">
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                data-testid="supplier-review-unit"
                className="block w-full h-11 rounded-sm border border-ink-600 bg-ink-900 px-3 text-white outline-none focus:border-brand"
              />
            </SheetField>
            <SheetField label="Price">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                data-testid="supplier-review-price"
                className="block w-full h-11 rounded-sm border border-ink-600 bg-ink-900 px-3 text-white outline-none focus:border-brand"
              />
            </SheetField>
          </div>

          <label className="flex items-start gap-3 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={phase.gstInclusive}
              onChange={(e) => onUpdate({ gstInclusive: e.target.checked })}
              data-testid="supplier-review-gst"
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              Price includes GST, save ex-GST
              <span className="block text-xs text-ink-400">
                Most NZ supplier storefronts display GST-inclusive.
              </span>
            </span>
          </label>

          {exGst !== null && (
            <div
              data-testid="supplier-review-preview"
              className="rounded-sm border border-ink-700 bg-ink-800/60 p-2 font-mono text-xs text-ink-200"
            >
              {phase.gstInclusive
                ? `// $${priceNum.toFixed(2)} inc GST → $${exGst.toFixed(2)} ex GST`
                : `// $${priceNum.toFixed(2)} ex GST (saved as-is)`}
            </div>
          )}

          {phase.saveError && (
            <div
              role="alert"
              data-testid="supplier-review-error"
              className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {phase.saveError}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-sm border border-ink-700 bg-ink-800 px-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:border-ink-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                name: name.trim(),
                unit: unit.trim(),
                price: priceNum,
                gstInclusive: phase.gstInclusive,
              })
            }
            data-testid="supplier-review-save"
            className="t2q-btn-primary h-11 px-5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase.saving ? "Saving…" : "Save to Materials"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualFallbackSheet({
  sourceUrl,
  onCancel,
}: {
  sourceUrl: string;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="supplier-manual-sheet"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="t2q-card w-full max-w-md rounded-b-none p-5 sm:rounded-sm sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
          {"// no product found"}
        </div>
        <h2 className="mt-1 font-display text-lg uppercase tracking-tight sm:text-xl">
          Couldn&apos;t read this page.
        </h2>
        <p className="mt-2 text-sm text-ink-300">
          The page might be a category, blocked, or hidden behind a login.
          Add the material by hand — the URL will pre-fill.
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-sm border border-ink-700 bg-ink-800 px-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:border-ink-500 hover:text-white"
          >
            Close
          </button>
          <Link
            href={`/app/materials/capture?url=${encodeURIComponent(sourceUrl)}`}
            data-testid="supplier-manual-link"
            className="t2q-btn-primary h-11 px-5"
          >
            Enter manually
          </Link>
        </div>
      </div>
    </div>
  );
}

function SavedToast({
  name,
  onDismiss,
}: {
  name: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      data-testid="supplier-saved-toast"
      className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-sm border border-brand/50 bg-brand/15 px-4 py-3 text-sm text-white shadow-lg sm:bottom-28"
    >
      <div className="flex items-start justify-between gap-3">
        <p>
          <span className="font-display uppercase tracking-tight text-brand">
            Saved.
          </span>{" "}
          <span className="text-ink-100">{name}</span> is in your materials.
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 text-ink-300 hover:text-white"
        >
          <X size={14} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <Link
        href="/app/materials"
        className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.25em] text-brand underline decoration-dotted"
      >
        View materials →
      </Link>
    </div>
  );
}

function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="supplier-error-toast"
      className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-lg sm:bottom-28"
    >
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 text-red-200 hover:text-white"
        >
          <X size={14} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function SheetField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
