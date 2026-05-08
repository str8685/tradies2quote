"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function QuoteGenerator({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [pending, setPending] = useState<boolean>(true);
  const startedRef = useRef<boolean>(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 409) {
        router.refresh();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `Generation failed (${res.status}).`);
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <section
      data-testid="quote-generator"
      className="t2q-card flex min-h-[420px] flex-col items-center justify-center p-8 text-center"
    >
      {pending ? (
        <>
          <WaveLoader />
          <h2 className="mt-8 font-display text-2xl uppercase tracking-tight sm:text-3xl">
            Generating your <span className="text-brand">quote</span>…
          </h2>
          <p
            aria-live="polite"
            className="mt-3 max-w-sm text-sm text-ink-300 sm:text-base"
          >
            Itemising materials, labour, and tax based on your description.
          </p>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
            {"// usually 5–15 seconds"}
          </p>
        </>
      ) : (
        <>
          <p
            data-testid="quote-generator-error"
            className="font-display text-xl uppercase tracking-tight text-red-400"
          >
            Generation failed
          </p>
          <p className="mt-3 max-w-md text-sm text-ink-300">{error}</p>
          <button
            type="button"
            onClick={() => {
              startedRef.current = true;
              void generate();
            }}
            className="t2q-btn-primary mt-6"
          >
            Try again
          </button>
        </>
      )}
    </section>
  );
}

function WaveLoader() {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div
      aria-hidden="true"
      className="flex h-16 items-end gap-1.5"
    >
      {bars.map((i) => (
        <span
          key={i}
          className="t2q-wave-bar h-full animate-wave"
          style={{ animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </div>
  );
}
