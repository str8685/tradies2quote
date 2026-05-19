"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, UploadSimple, X } from "@phosphor-icons/react/dist/ssr";

type ScanState = "idle" | "uploading" | "error";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ScanPanel({
  transcript,
  setTranscript,
}: {
  transcript: string;
  setTranscript: (s: string) => void;
}) {
  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");
  const [buildType, setBuildType] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTranscript("");
    setBuildType("");
    setError("");
    setState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError("");
    if (file.size === 0) {
      setError("That file is empty.");
      setState("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max 8 MB — try compressing or taking a smaller photo.`,
      );
      setState("error");
      return;
    }
    const type = (file.type || "").toLowerCase();
    if (!ACCEPTED_MIME.includes(type) && !ACCEPTED_MIME.includes(type.replace("jpg", "jpeg"))) {
      setError(`Unsupported file type: ${file.type || "unknown"}. Use JPEG or PNG.`);
      setState("error");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setState("uploading");

    const form = new FormData();
    form.append("image", file, file.name || "drawing.jpg");
    if (hint.trim().length > 0) {
      form.append("hint", hint.trim());
    }

    try {
      const res = await fetch("/api/quotes/scan-drawing", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `Scan failed (${res.status}).`);
        setState("error");
        return;
      }
      const data = (await res.json()) as {
        transcript?: string;
        buildType?: string;
      };
      setTranscript((data.transcript ?? "").trim());
      setBuildType((data.buildType ?? "").trim());
      setState("idle");
    } catch {
      setError("Network error. Check your connection and try again.");
      setState("error");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }

  return (
    <section
      id="panel-scan"
      role="tabpanel"
      aria-labelledby="tab-scan"
      data-testid="panel-scan"
      className="t2q-card-pro p-6 sm:p-8"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        data-testid="scan-upload-input"
        onChange={onFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="scan-camera-input"
        onChange={onFileChange}
      />

      {transcript ? (
        <ScanReview
          transcript={transcript}
          buildType={buildType}
          previewUrl={previewUrl}
          onChange={setTranscript}
          onRedo={reset}
        />
      ) : (
        <div className="flex flex-col items-center text-center">
          {previewUrl && state === "uploading" ? (
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Drawing preview"
                className="mx-auto max-h-48 w-auto rounded-sm border border-ink-600 opacity-70"
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="mb-4 grid h-28 w-28 place-items-center rounded-full border-2 border-brand text-brand"
            >
              <Camera weight="bold" className="h-12 w-12" />
            </div>
          )}

          <h3 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Scan a hand-drawn plan
          </h3>
          <p className="mt-2 max-w-sm text-sm text-ink-300">
            Snap your sketch — deck, fence, framing — and we&rsquo;ll read the
            dimensions and work out the materials.
          </p>

          <div className="mt-5 flex w-full flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={state === "uploading"}
              data-testid="scan-take-photo"
              className="t2q-btn-primary-pro inline-flex min-h-[44px] items-center justify-center gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera weight="bold" className="h-5 w-5" />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={state === "uploading"}
              data-testid="scan-upload"
              className="t2q-btn-ghost-pro inline-flex min-h-[44px] items-center justify-center gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadSimple weight="bold" className="h-5 w-5" />
              Upload image
            </button>
          </div>

          <div className="mt-5 w-full max-w-md text-left">
            <label
              htmlFor="scan-hint"
              className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400"
            >
              Optional context
            </label>
            <input
              id="scan-hint"
              data-testid="scan-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              maxLength={500}
              placeholder="e.g. Treated pine deck, 1.2m off ground."
              className="mt-2 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-brand"
            />
          </div>

          <p
            data-testid="scan-status"
            aria-live="polite"
            className="mt-4 min-h-5 text-sm text-ink-300"
          >
            {state === "idle" && "Up to 8 MB. JPEG or PNG works best."}
            {state === "uploading" && "Reading your drawing…"}
            {state === "error" && (
              <span data-testid="scan-error" className="text-red-400">
                {error}
              </span>
            )}
          </p>

          {state === "error" && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex min-h-[44px] items-center text-sm font-mono uppercase tracking-[0.2em] text-brand hover:text-brand-300"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ScanReview({
  transcript,
  buildType,
  previewUrl,
  onChange,
  onRedo,
}: {
  transcript: string;
  buildType: string;
  previewUrl: string | null;
  onChange: (s: string) => void;
  onRedo: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">
            Drawing read
          </div>
          {buildType && (
            <p className="mt-1 font-display text-base uppercase tracking-tight text-white">
              {buildType}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRedo}
          data-testid="scan-clear"
          aria-label="Remove drawing"
          className="grid h-9 w-9 place-items-center rounded-sm border border-ink-600 text-ink-300 hover:border-brand hover:text-brand"
        >
          <X weight="bold" className="h-4 w-4" />
        </button>
      </div>

      {previewUrl && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Scanned drawing"
            className="max-h-56 w-auto rounded-sm border border-ink-600"
          />
        </div>
      )}

      <label
        htmlFor="scan-transcript"
        className="mt-4 block font-mono text-xs uppercase tracking-[0.2em] text-ink-400"
      >
        Takeoff — review before we quote
      </label>
      <textarea
        id="scan-transcript"
        data-testid="scan-transcript"
        value={transcript}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="mt-2 block w-full resize-y rounded-sm border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-white outline-none focus:border-brand"
      />
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {"// edit anything that's wrong — the quote will be built off this text"}
      </p>
    </div>
  );
}
