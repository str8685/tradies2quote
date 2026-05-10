"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ACTION_INITIAL,
  type ActionResult,
  createMaterial,
} from "../../actions";
import { supplierFromUrl } from "../_lib/supplier-from-url";

/**
 * Client-side capture form for /app/materials/capture.
 *
 * Owns:
 *   - URL paste box (the "iPhone / no-PWA" fallback) — auto-detects the
 *     supplier from the hostname when a URL arrives.
 *   - Name / unit / displayed price.
 *   - "Price includes GST (15%)" toggle. Default ON because most NZ supplier
 *     storefronts show GST-inclusive prices. When ticked, divides by 1.15
 *     before submit so the row stored on `materials.default_unit_price`
 *     stays ex-GST (matching how the rest of the codebase treats prices).
 *   - Confirmation modal that previews the row before save.
 *
 * Submit goes through the existing `createMaterial` server action — no new
 * write path, no API route, no new dependency.
 */

const NOTES_DEFAULT = "Captured manually. Confirm price with supplier.";
const UNIT_SUGGESTIONS = [
  "each",
  "sheet",
  "m",
  "m²",
  "m³",
  "kg",
  "pair",
  "lot",
  "roll",
  "box",
  "bag",
];

type Props = {
  initialUrl: string;
  initialName: string;
  initialSupplier: string;
  /** True when the page got no share params — show the paste-flow hint banner. */
  isPasteFallback: boolean;
};

export function CaptureForm({
  initialUrl,
  initialName,
  initialSupplier,
  isPasteFallback,
}: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState("each");
  const [displayPrice, setDisplayPrice] = useState("");
  const [incGst, setIncGst] = useState(true);
  const [supplier, setSupplier] = useState(initialSupplier);
  const [notes, setNotes] = useState(NOTES_DEFAULT);
  const [confirming, setConfirming] = useState(false);
  // Tracks whether the user has typed in the supplier field — once they do,
  // we stop overwriting it with hostname-derived auto-detection.
  const [supplierEdited, setSupplierEdited] = useState(false);

  // When the URL changes (and the user hasn't manually overridden the
  // supplier), re-derive the supplier from the new hostname.
  useEffect(() => {
    if (supplierEdited) return;
    const detected = supplierFromUrl(url);
    if (detected) setSupplier(detected);
  }, [url, supplierEdited]);

  // GST math (client-side preview + save value).
  const priceNum = Number(displayPrice);
  const isValidPrice = Number.isFinite(priceNum) && priceNum >= 0;
  const finalPrice = isValidPrice
    ? incGst
      ? Math.round((priceNum / 1.15) * 100) / 100
      : Math.round(priceNum * 100) / 100
    : null;

  const canConfirm =
    name.trim().length > 0 && unit.trim().length > 0 && finalPrice !== null;

  const [state, formAction] = useActionState<ActionResult, FormData>(
    createMaterial,
    ACTION_INITIAL,
  );
  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <div className="space-y-5">
      {isPasteFallback && (
        <div
          data-testid="capture-paste-hint"
          className="rounded-sm border border-hivis/40 bg-hivis/10 p-3 text-xs text-hivis"
        >
          <strong className="font-display tracking-tight uppercase">
            // paste flow
          </strong>
          <p className="mt-1 text-ink-100">
            Paste the supplier product URL below — works on iPhone and any
            browser without the share sheet. After install, tap Share in your
            supplier app and pick Tradies2Quote to skip this step.
          </p>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="capture-error"
          className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {errorMessage}
        </div>
      )}

      <Field label="Product URL" hint="From the supplier's product page.">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.mitre10.co.nz/shop/…"
          data-testid="capture-url"
          className="block w-full h-11 px-3 bg-ink-900 border border-ink-600 text-white placeholder:text-ink-500 outline-none focus:border-brand rounded-sm"
        />
      </Field>

      <Field label="Supplier">
        <input
          type="text"
          value={supplier}
          onChange={(e) => {
            setSupplier(e.target.value);
            setSupplierEdited(true);
          }}
          placeholder="Mitre 10, Bunnings, ITM, PlaceMakers…"
          data-testid="capture-supplier"
          className="block w-full h-11 px-3 bg-ink-900 border border-ink-600 text-white placeholder:text-ink-500 outline-none focus:border-brand rounded-sm"
        />
      </Field>

      <Field label="Product name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GIB Standard 10mm 2400x1200"
          data-testid="capture-name"
          required
          className="block w-full h-11 px-3 bg-ink-900 border border-ink-600 text-white placeholder:text-ink-500 outline-none focus:border-brand rounded-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" required>
          <input
            type="text"
            list="capture-unit-suggestions"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            data-testid="capture-unit"
            required
            className="block w-full h-11 px-3 bg-ink-900 border border-ink-600 text-white placeholder:text-ink-500 outline-none focus:border-brand rounded-sm"
          />
          <datalist id="capture-unit-suggestions">
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label="Displayed price" required>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={displayPrice}
            onChange={(e) => setDisplayPrice(e.target.value)}
            placeholder="0.00"
            data-testid="capture-price"
            required
            className="block w-full h-11 px-3 bg-ink-900 border border-ink-600 text-white placeholder:text-ink-500 outline-none focus:border-brand rounded-sm"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-200 cursor-pointer">
        <input
          type="checkbox"
          checked={incGst}
          onChange={(e) => setIncGst(e.target.checked)}
          data-testid="capture-inc-gst"
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <span>
          <span className="font-medium">Price includes GST (15%)</span>
          <span className="block text-xs text-ink-400 mt-0.5">
            Most NZ supplier sites display GST-inclusive prices. Untick if your
            supplier shows ex-GST.
          </span>
        </span>
      </label>

      {isValidPrice && (
        <div
          data-testid="capture-price-preview"
          className="rounded-sm border border-ink-700 bg-ink-800/60 p-3 font-mono text-xs text-ink-200"
        >
          {incGst
            ? `// $${priceNum.toFixed(2)} inc GST → $${finalPrice!.toFixed(2)} ex GST (saved)`
            : `// $${priceNum.toFixed(2)} ex GST (saved as-is)`}
        </div>
      )}

      <Field label="Notes" hint="Hidden from clients.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          data-testid="capture-notes"
          className="block w-full px-3 py-2 bg-ink-900 border border-ink-600 text-white placeholder:text-ink-500 outline-none focus:border-brand rounded-sm"
        />
      </Field>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!canConfirm}
          data-testid="capture-review"
          className="t2q-btn-primary h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review and save →
        </button>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-confirm-title"
          data-testid="capture-confirm-dialog"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
        >
          <div className="t2q-card w-full max-w-md p-5 sm:p-6">
            <h2
              id="capture-confirm-title"
              className="font-display text-xl uppercase tracking-tight"
            >
              Save this material?
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Name" value={name.trim()} />
              <Row label="Unit" value={unit.trim()} />
              <Row
                label="Price (ex GST)"
                value={
                  finalPrice !== null
                    ? `NZD ${finalPrice.toFixed(2)}`
                    : "—"
                }
                mono
              />
              {incGst && isValidPrice && (
                <Row
                  label="From inc-GST"
                  value={`NZD ${priceNum.toFixed(2)}`}
                  mono
                  muted
                />
              )}
              {supplier.trim() && (
                <Row label="Supplier" value={supplier.trim()} />
              )}
              {url.trim() && (
                <Row label="URL" value={url.trim()} mono truncate />
              )}
              {notes.trim() && <Row label="Notes" value={notes.trim()} muted />}
            </dl>

            <form
              action={formAction}
              className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
            >
              <input type="hidden" name="name" value={name.trim()} />
              <input type="hidden" name="unit" value={unit.trim()} />
              <input
                type="hidden"
                name="default_unit_price"
                value={finalPrice !== null ? String(finalPrice) : ""}
              />
              <input type="hidden" name="supplier" value={supplier.trim()} />
              <input type="hidden" name="supplier_url" value={url.trim()} />
              <input type="hidden" name="notes" value={notes.trim()} />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                data-testid="capture-confirm-edit"
                className="h-10 px-4 text-sm font-mono uppercase tracking-[0.2em] text-ink-300 hover:text-white"
              >
                Edit
              </button>
              <SaveButton />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="capture-confirm-save"
      className="t2q-btn-primary h-10 px-5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Add to materials"}
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
        {label}
        {required && <span className="text-brand"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </label>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-700/70 pb-2 last:border-b-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-400">
        {label}
      </span>
      <span
        className={[
          "text-sm",
          mono ? "font-mono" : "",
          muted ? "text-ink-400" : "text-white",
          truncate ? "truncate max-w-[60%]" : "",
        ].join(" ")}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}
