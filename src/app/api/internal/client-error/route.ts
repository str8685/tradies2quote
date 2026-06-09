import { NextResponse, type NextRequest } from "next/server";
import { captureClientReport } from "@/lib/observability";

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
 *     whether a write happened (no oracle for abuse).
 *   - Non-blocking + failure-safe: the write is scheduled off the response via
 *     captureClientReport; this handler never throws.
 *   - Bounded: oversized or non-JSON payloads are dropped (still 204).
 */
const MAX_BYTES = 8 * 1024; // 8 KB — generous for name+message+stack, caps abuse

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) {
      return new NextResponse(null, { status: 204 });
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
