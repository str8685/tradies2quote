// On-demand weather assessment for a single scheduled quote ("job").
// Used when a job is created/scheduled or edited, and for a manual "re-check"
// button in the Workboard. User-authenticated; assessJob re-checks ownership.
// Gated by the weather-planning flag. Runs the deterministic engine and (for
// risky jobs) Pat/Willa — Willa output is stored as a DRAFT, never sent.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isWeatherPlanningEnabled } from "@/lib/weather-planning/flag";
import { assessJob, type TriggerSource } from "@/lib/weather-planning/assess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isWeatherPlanningEnabled()) {
    return NextResponse.json({ error: "disabled", message: "Weather planning is not enabled." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { quoteId?: string; triggerSource?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Expected JSON { quoteId }." }, { status: 400 });
  }
  if (!body.quoteId) {
    return NextResponse.json({ error: "bad_request", message: "quoteId is required." }, { status: 400 });
  }

  const source: TriggerSource =
    body.triggerSource === "on_change" || body.triggerSource === "manual" ? body.triggerSource : "manual";

  try {
    const result = await assessJob({ quoteId: body.quoteId, userId: user.id, triggerSource: source });
    return NextResponse.json(result);
  } catch (err) {
    console.error("on-demand weather assess failed", body.quoteId, err);
    return NextResponse.json({ error: "assess_failed" }, { status: 500 });
  }
}
