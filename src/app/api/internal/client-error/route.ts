import { NextResponse, type NextRequest } from "next/server";
import { captureClientReport } from "@/lib/observability";
import { consumeFixedWindow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/client-error
 *
 * Ingest endpoint for BROWSER errors (React error boundaries + global
 * handlers). The page posts a minimal sanitized payload via `sendBeacon` /
 * keepalive fetch; we record it into the internal monitor (surface "client").
 *
 * Posture:
 *   - PUBLIC + unauthenticated on purpose — client crashes happen pre-auth and
 *     across the marketing/auth/quote pages. It accepts ONLY a tiny error
 *     shape (name/message/stack/kind/path), never request bodies or user data.
 *   - Always returns 204 with no body — never reflects input, never reveals
 *     whether a write happened (and never reveals throttling: no oracle).
 *   - Non-blocking + failure-safe: the write is scheduled off the response via
 *     captureClientReport; this handler never throws.
 *   - Bounded: oversized or non-JSON payloads are dropped (still 204).
 *   - Rate-limited per IP (short fixed window) so a runaway client loop or a
 *     scripted spammer can't inflate event volume. Throttled requests are
 *     silently dropped (no write) and STILL return 204. The cap is far above
 *     any real browser's error rate, so normal users never notice it.
 */
const MAX_BYTES = 8 * 1024; // 8 KB — generous for name+message+stack, caps abuse
// Per IP, per serverless instance: a real browser never emits anywhere near 60
// distinct errors a minute; a runaway loop / spammer does. Recovers each window.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

// Same IP derivation the public quote routes use (accept/chat route.ts).
function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    // Per-IP throttle BEFORE parsing/writing so a flood is cheap to shed.
    const { ok } = consumeFixedWindow(
      `clienterr:${clientIp(request)}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!ok) {
      return new NextResponse(null, { status: 204 }); // throttled — drop, no write
    }

    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      return new NextResponse(null, { status: 204 });
    }
    captureClientReport(body); // sanitizes + writes off the hot path; never throws
  } catch {
    /* ingest must never error the client */
  }
  return new NextResponse(null, { status: 204 });
}
