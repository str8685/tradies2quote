"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  CheckCircle,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { toExGst } from "@/lib/materials/quoteExtraction";
import { TapeMeasureProgress } from "@/app/app/_components/TapeMeasureProgress";
import {
  importSupplierQuoteItems,
  type SupplierQuoteRow,
} from "../../actions";

type Phase = "idle" | "extracting" | "review" | "saving" | "done" | "error";

type ReviewRow = {
  id: string;
  include: boolean;
  name: string;
  unit: string;
  price: string; // kept as string for the input; parsed on save
  sku: string | null;
  lowConfidence: boolean;
};

type ExtractResponse = {
  supplier: string | null;
  currency: string | null;
  gst_inclusive: boolean | null;
  items: Array<{
    name: string;
    unit: string;
    price: number | null;
    sku: string | null;
    confidence: number;
  }>;
  notes: string[];
};

const MAX_BYTES = 8 * 1024 * 1024;

export function QuoteImportClient({ currency }: { currency: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");
  const [gstInclusive, setGstInclusive] = useState<boolean>(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    failed: number;
  } | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    if (f.size > MAX_BYTES) {
      setError("That photo is over 8 MB. Try a smaller image.");
      setFileName("");
      return;
    }
    setFileName(f.name);
  }

  async function scan() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setError("Choose a photo of the quote first.");
      return;
    }
    setError("");
    setPhase("extracting");
    try {
      const fd = new FormData();
      fd.append("image", f);
      const res = await fetch("/api/materials/extract-quote", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(data.message ?? data.error ?? "Could not scan that quote.");
        setPhase("error");
        return;
      }
      const data = (await res.json()) as ExtractResponse;
      setSupplier(data.supplier ?? "");
      setGstInclusive(data.gst_inclusive === true);
      setNotes(data.notes ?? []);
      setRows(
        data.items.map((it) => ({
          id: crypto.randomUUID(),
          include: it.price !== null && it.price > 0,
          name: it.name,
          unit: it.unit,
          price: it.price !== null ? String(it.price) : "",
          sku: it.sku,
          lowConfidence: it.confidence < 0.6,
        })),
      );
      setPhase("review");
    } catch {
      setError("Network error. Please try again.");
      setPhase("error");
    }
  }

  function patchRow(id: string, patch: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const includable = rows.filter((r) => {
    const p = Number(r.price);
    return r.include && r.name.trim() && Number.isFinite(p) && p > 0;
  });

  async function save() {
    if (includable.length === 0) {
      setError("Tick at least one line with a name and a price above zero.");
      return;
    }
    setError("");
    setPhase("saving");
    const payload: SupplierQuoteRow[] = includable.map((r) => ({
      name: r.name.trim(),
      unit: r.unit.trim() || "each",
      default_unit_price: toExGst(Number(r.price), gstInclusive),
      sku: r.sku,
      notes: null,
    }));
    try {
      const res = await importSupplierQuoteItems(
        payload,
        supplier.trim() || null,
      );
      if (res.error) {
        setError(res.error);
        setPhase("review");
        return;
      }
      setResult({
        inserted: res.inserted,
        updated: res.updated,
        failed: res.failed,
      });
      setPhase("done");
    } catch {
      setError("Could not save to your library. Please try again.");
      setPhase("review");
    }
  }

  // ── Done state ──────────────────────────────────────────────────────
  if (phase === "done" && result) {
    return (
      <section className="t2q-card-pro mt-6 p-5 sm:p-6" data-testid="quote-import-done">
        <div className="flex items-start gap-3">
          <CheckCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-brand" />
          <div>
            <h2 className="font-display text-lg uppercase tracking-tight text-white">
              Added to your library.
            </h2>
            <p className="mt-1 text-sm text-ink-300">
              {result.inserted} new, {result.updated} updated
              {result.failed > 0 ? `, ${result.failed} failed` : ""}. These
              prices are marked as scanned estimates — confirm them with the
              supplier before relying on them.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/materials" className="t2q-btn-primary-pro inline-flex h-11 px-5">
            View library
          </Link>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setResult(null);
              setFileName("");
              setSupplier("");
              setNotes([]);
              if (fileRef.current) fileRef.current.value = "";
              setPhase("idle");
            }}
            className="t2q-btn-ghost-pro inline-flex h-11 px-5"
          >
            <Camera size={18} weight="bold" />
            Scan another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onFileChosen}
        data-testid="quote-import-file"
      />

      {/* Upload + scan */}
      {(phase === "idle" || phase === "extracting" || phase === "error") && (
        <div className="t2q-card-pro p-5 sm:p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
            {"// step 1 — photo"}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={pickFile}
              disabled={phase === "extracting"}
              className="t2q-btn-ghost-pro inline-flex h-11 px-5 disabled:opacity-50"
            >
              <Camera size={18} weight="bold" />
              {fileName ? "Change photo" : "Choose / take photo"}
            </button>
            {fileName && (
              <span className="truncate font-mono text-xs text-ink-300" data-testid="quote-import-filename">
                {fileName}
              </span>
            )}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={scan}
              disabled={phase === "extracting" || !fileName}
              data-testid="quote-import-scan"
              className="t2q-btn-primary-pro inline-flex h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === "extracting" ? "Reading quote…" : "Scan quote"}
            </button>
          </div>
          {phase === "extracting" && (
            <div className="mt-4 flex justify-center">
              <TapeMeasureProgress estimateMs={18000} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          data-testid="quote-import-error"
          className="mt-4 rounded-sm border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {/* Review */}
      {(phase === "review" || phase === "saving") && (
        <div className="mt-4 space-y-4">
          <div className="t2q-card-pro p-4 sm:p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
              {"// step 2 — check the lines"}
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <label className="flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                  Supplier
                </span>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. ITM"
                  className="mt-1 w-full rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={gstInclusive}
                  onChange={(e) => setGstInclusive(e.target.checked)}
                  className="h-4 w-4 accent-brand"
                  data-testid="quote-import-gst"
                />
                <span className="text-sm text-ink-200">Prices include GST</span>
              </label>
            </div>
            {notes.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-sm border border-hivis/30 bg-hivis/5 p-3">
                <li className="font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
                  {"// double-check"}
                </li>
                {notes.map((n, i) => (
                  <li key={i} className="text-xs text-ink-200">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="space-y-2" data-testid="quote-import-rows">
            {rows.map((r) => {
              const priceNum = Number(r.price);
              const badPrice = !Number.isFinite(priceNum) || priceNum <= 0;
              return (
                <li
                  key={r.id}
                  className={`rounded-sm border p-3 ${r.include ? "border-ink-700 bg-ink-900/60" : "border-ink-800 bg-ink-950/40 opacity-60"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => patchRow(r.id, { include: e.target.checked })}
                      className="mt-2 h-4 w-4 shrink-0 accent-brand"
                      aria-label="Include this line"
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => patchRow(r.id, { name: e.target.value })}
                        className="w-full rounded-sm border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={r.unit}
                          onChange={(e) => patchRow(r.id, { unit: e.target.value })}
                          aria-label="Unit"
                          className="w-20 rounded-sm border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-white outline-none focus:border-brand"
                        />
                        <div className="inline-flex items-center rounded-sm border border-ink-700 bg-ink-900 focus-within:border-brand">
                          <span className="pl-2 font-mono text-xs text-ink-400">
                            {currency}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={r.price}
                            onChange={(e) => patchRow(r.id, { price: e.target.value })}
                            aria-label="Unit price"
                            className={`w-24 bg-transparent px-2 py-1.5 text-sm outline-none ${badPrice && r.include ? "text-red-300" : "text-white"}`}
                          />
                        </div>
                        {r.sku && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                            {r.sku}
                          </span>
                        )}
                        {r.lowConfidence && (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-hivis/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-hivis">
                            <Warning size={10} weight="fill" />
                            check
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRow(r.id)}
                          aria-label="Remove line"
                          className="ml-auto text-ink-500 hover:text-red-300"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>
                      {badPrice && r.include && (
                        <p className="mt-1 text-[11px] text-red-300">
                          Add a price above zero, or untick this line.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-sm border border-ink-700 bg-ink-950/95 p-3 shadow-lg">
            <button
              type="button"
              onClick={save}
              disabled={phase === "saving" || includable.length === 0}
              data-testid="quote-import-save"
              className="t2q-btn-primary-pro inline-flex h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={18} weight="bold" />
              {phase === "saving"
                ? "Saving…"
                : `Add ${includable.length} to library`}
            </button>
            <Link href="/app/materials" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 hover:text-ink-100">
              Cancel
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
