import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runMaterialsTakeoffAgent,
  type MaterialsTakeoffInput,
} from "@/lib/agents/materials-takeoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/materials-takeoff
 *
 * Body: { jobText: string, country?: "NZ" | "AU" | "UK" | "US" | "CA" }
 * Returns: { understoodAs, lines: [...], assumptions: [...], reviewFlags: [...] }
 *
 * Auth gated. Never writes to the database. Never claims a supplier
 * price — the user pulls real prices from their library on the quote
 * editor.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<MaterialsTakeoffInput>;
  try {
    body = (await req.json()) as Partial<MaterialsTakeoffInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobText = typeof body.jobText === "string" ? body.jobText : "";
  if (jobText.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing 'jobText' field" },
      { status: 400 },
    );
  }

  try {
    const result = await runMaterialsTakeoffAgent({
      jobText,
      country: body.country ?? "NZ",
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
