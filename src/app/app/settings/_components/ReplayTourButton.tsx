"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "t2q-tour-done";

export function ReplayTourButton() {
  const router = useRouter();

  function replayTour() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The dashboard replay param below still forces the tour if
      // storage is unavailable.
    }
    router.push("/app?tour=1");
  }

  return (
    <button
      type="button"
      data-testid="settings-replay-tour"
      onClick={replayTour}
      className="t2q-card-pro t2q-card-pro-hover flex w-full items-center gap-4 p-4 text-left sm:p-5"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand"
      >
        <ArrowClockwise size={22} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base uppercase tracking-tight text-white sm:text-lg">
          Replay quick tour.
        </span>
        <span className="mt-0.5 block text-sm text-ink-300">
          Step-by-step coachmarks on the live dashboard.
        </span>
      </span>
    </button>
  );
}
