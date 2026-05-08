"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Download,
  Upload,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import {
  REQUIRED_CSV_HEADERS,
  parseMaterialsCsv,
  type CsvParseResult,
} from "@/lib/materials";
import { importMaterials } from "../../actions";

export function ImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    failed: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("CSV is too large (max 2 MB).");
      setParsed(null);
      return;
    }
    try {
      const text = await file.text();
      const result = parseMaterialsCsv(text);
      setFileName(file.name);
      setParsed(result);
    } catch {
      setError("Could not read that file.");
      setParsed(null);
    }
  }

  function handleImport() {
    if (!parsed || parsed.valid.length === 0) return;
    setError("");
    startTransition(async () => {
      const res = await importMaterials(parsed.valid);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult({
        inserted: res.inserted,
        updated: res.updated,
        failed: res.failed,
      });
      router.refresh();
    });
  }

  function reset() {
    setParsed(null);
    setError("");
    setResult(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <section className="t2q-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
              {"// step 1"}
            </p>
            <h2 className="mt-1 font-display text-lg uppercase tracking-tight">
              Download the template
            </h2>
          </div>
          <a
            href="/materials-template.csv"
            download
            data-testid="csv-template-download"
            className="t2q-btn-ghost"
          >
            <Download size={18} weight="bold" />
            Template
          </a>
        </div>
        <p className="mt-3 text-sm text-ink-300">
          Required columns: <code className="text-white">{REQUIRED_CSV_HEADERS.join(", ")}</code>.
          Optional: <code className="text-white">supplier, supplier_url, notes</code>.
        </p>
      </section>

      <section className="t2q-card p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
          {"// step 2"}
        </p>
        <h2 className="mt-1 font-display text-lg uppercase tracking-tight">
          Upload your CSV
        </h2>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-ink-700 bg-ink-900 p-8 text-center transition-colors hover:border-brand">
          <Upload size={28} weight="bold" className="text-ink-400" />
          <span className="mt-3 font-display text-sm uppercase tracking-tight">
            {fileName ? fileName : "Choose a CSV file"}
          </span>
          <span className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
            {fileName ? "// click to change" : "// max 2 MB"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            data-testid="csv-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="hidden"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </section>

      {parsed && (
        <section className="t2q-card p-5 sm:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
            {"// step 3"}
          </p>
          <h2 className="mt-1 font-display text-lg uppercase tracking-tight">
            Review &amp; import
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              testId="csv-valid-count"
              icon={<CheckCircle size={16} weight="bold" />}
              label="Ready to import"
              value={parsed.valid.length}
              accent="brand"
            />
            <Stat
              testId="csv-invalid-count"
              icon={<Warning size={16} weight="bold" />}
              label="Skipped"
              value={parsed.invalid.length}
              accent="hivis"
            />
          </div>

          {parsed.invalid.length > 0 && (
            <ul className="mt-4 max-h-48 overflow-auto rounded-sm border border-hivis/40 bg-hivis/5 p-3 text-xs text-hivis">
              {parsed.invalid.map((r, i) => (
                <li key={i} className="font-mono">
                  Row {r.row}: {r.reason}
                </li>
              ))}
            </ul>
          )}

          {parsed.valid.length > 0 && (
            <div className="mt-4 max-h-64 overflow-auto rounded-sm border border-ink-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-800 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {parsed.valid.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-white">{r.name}</td>
                      <td className="px-3 py-2 text-ink-300">{r.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-white">
                        {r.default_unit_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-ink-300">{r.supplier ?? "—"}</td>
                    </tr>
                  ))}
                  {parsed.valid.length > 50 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-center font-mono text-xs uppercase tracking-[0.2em] text-ink-500"
                      >
                        {`// + ${parsed.valid.length - 50} more rows`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {result ? (
            <div
              data-testid="import-result"
              className="mt-5 rounded-sm border border-brand/40 bg-brand/10 px-3 py-3 text-sm text-white"
            >
              Imported <strong className="text-brand">{result.inserted}</strong>, updated{" "}
              <strong className="text-brand">{result.updated}</strong>
              {result.failed > 0 && (
                <>
                  , <strong className="text-red-300">{result.failed} failed</strong>
                </>
              )}
              .
            </div>
          ) : (
            <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={reset}
                className="font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
              >
                ← Choose a different file
              </button>
              <button
                type="button"
                data-testid="csv-import-confirm"
                disabled={parsed.valid.length === 0 || isPending}
                onClick={handleImport}
                className="t2q-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Importing…"
                  : `Import ${parsed.valid.length} row${parsed.valid.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "brand" | "hivis";
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={[
        "rounded-sm border px-3 py-2",
        accent === "brand"
          ? "border-brand/40 bg-brand/10"
          : "border-hivis/40 bg-hivis/10",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
          accent === "brand" ? "text-brand" : "text-hivis",
        ].join(" ")}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-2xl tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
