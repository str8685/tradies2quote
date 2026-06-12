"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/clientReport";

/**
 * Global window error hooks — the piece clientReport.ts was written for but
 * was never mounted. React error boundaries only see RENDER errors; failures
 * in event handlers, timers and un-awaited promises (e.g. a fire-and-forget
 * fetch in the voice recorder) bypass them entirely. These two listeners are
 * the only way those reach the internal monitor.
 *
 * Renders nothing. Reporting is fire-and-forget and the endpoint is
 * per-IP rate-limited server-side; the small local dedupe just stops one
 * tight error loop from spamming the beacon.
 */
export function GlobalErrorListeners() {
  useEffect(() => {
    const seen = new Set<string>();
    const shouldReport = (key: string) => {
      if (seen.has(key)) return false;
      seen.add(key);
      if (seen.size > 20) seen.clear();
      return true;
    };

    const onError = (event: ErrorEvent) => {
      const key = `e:${event.message}`;
      if (shouldReport(key)) {
        reportClientError(event.error ?? event.message, "error");
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const key = `r:${reason instanceof Error ? reason.message : String(reason)}`;
      if (shouldReport(key)) {
        reportClientError(reason, "unhandledrejection");
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
