import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runCustomerReplyAgent,
  type CustomerReplyInput,
} from "@/lib/agents/customer-reply";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/customer-reply
 *
 * Body: { customerMessage: string, quote?: {...}, businessName?: string }
 * Returns: { intent, confidence, reasoning, replyDraft }
 *
 * Auth gated. Never writes to the database. No emails are sent.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<CustomerReplyInput>;
  try {
    body = (await req.json()) as Partial<CustomerReplyInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const customerMessage =
    typeof body.customerMessage === "string" ? body.customerMessage : "";
  if (customerMessage.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing 'customerMessage' field" },
      { status: 400 },
    );
  }

  try {
    const result = await runCustomerReplyAgent({
      customerMessage,
      quote: body.quote ?? null,
      businessName: body.businessName ?? null,
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
