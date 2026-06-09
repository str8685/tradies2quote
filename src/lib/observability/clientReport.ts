// ─────────────────────────────────────────────────────────────────────────
// Internal error monitoring — browser reporter (CLIENT-side, fire-and-forget).
//
// Sends a MINIMAL, sanitized error payload to /api/internal/client-error. Used
// by the React error boundaries and the global window handlers. Prefers
// `navigator.sendBeacon` (survives page unload, non-blocking); falls back to a
// keepalive fetch. NEVER throws — a reporter must not create new errors.
//
// Privacy: only name / message / stack / kind / pathname are sent. No request
// bodies, no form values, no query string, no customer data. The server
// re-scrubs + truncates everything before storage (see clientErrors.ts).
// ─────────────────────────────────────────────────────────────────────────

export type ClientErrorKind = "error" | "unhandledrejection" | "boundary";

const ENDPOINT = "/api/internal/client-error";
const MAX_STACK = 8000; // server truncates again to 4 KB after scrubbing

export function reportClientError(error: unknown, kind: ClientErrorKind): void {
  try {
    if (typeof window === "undefined") return;

    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Client error");

    const payload = {
      name: err.name,
      message: err.message,
      stack: typeof err.stack === "string" ? err.stack.slice(0, MAX_STACK) : undefined,
      kind,
      // pathname ONLY — never search/hash (avoids leaking query params).
      path: typeof window.location?.pathname === "string" ? window.location.pathname : undefined,
    };

    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* a reporter must never throw */
  }
}
