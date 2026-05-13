import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runQuoteGenerationAgent,
  type QuoteGenerationInput,
} from "@/lib/agents/quote-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/quote-generation
 *
 * Body: { transcript: string, labourRate?: number, markupPct?: number }
 * Returns: { ok: true, result: GeneratedQuote }
 *
 * Auth-gated (same pattern as `src/app/api/quotes/transcribe/route.ts`).
 * Never writes to the database. Never sends quotes. The caller
 * renders the JSON for the tradie to review / paste into a draft
 * quote. Distinct from `/api/quotes/generate` (the heavy production
 * pipeline that operates on an existing draft quote row).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<QuoteGenerationInput>;
  try {
    body = (await req.json()) as Partial<QuoteGenerationInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript : "";
  if (transcript.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing 'transcript' field" },
      { status: 400 },
    );
  }

  try {
    const result = await runQuoteGenerationAgent({
      transcript,
      labourRate:
        typeof body.labourRate === "number" ? body.labourRate : undefined,
      markupPct:
        typeof body.markupPct === "number" ? body.markupPct : undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isConfig = /not configured/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 502 },
    );
  }
}
