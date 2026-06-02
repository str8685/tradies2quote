import { NextResponse } from "next/server";
import { getCachedAuthUser } from "@/lib/supabase/auth";
import { isOwnerEmail } from "@/lib/owner";
import { buildAdminOverview } from "@/lib/admin/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview
 *
 * Owner-only. Returns the aggregated ops overview (money + growth +
 * connectors) as JSON so the dashboard can poll for a live feed without
 * a full page reload. Non-owners get a 404 so the route's existence
 * isn't advertised — same posture as the /app/admin page gate.
 */
export async function GET() {
  const { user } = await getCachedAuthUser();
  if (!user || !isOwnerEmail(user.email)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const overview = await buildAdminOverview();
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/admin/overview] failed", err);
    return NextResponse.json(
      {
        error: "overview_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
