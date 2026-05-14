import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runCustomerReplyAgent,
  type CustomerReplyInput,
} from "@/lib/agents/customer-reply";
import {
  logAgentRunStart,
  logAgentRunFinish,
} from "@/lib/agent-monitor/logger";

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

  const runId = `creply_${Math.random().toString(16).slice(2, 10)}`;
  const startedAt = Date.now();
  logAgentRunStart({
    agentName: "Customer Reply Agent",
    runId,
    stepName: "run.start",
    status: "running",
    message: `Drafting a reply to a ${customerMessage.trim().length}-char customer message`,
    startedAt,
  });

  try {
    const result = await runCustomerReplyAgent({
      customerMessage,
      quote: body.quote ?? null,
      businessName: body.businessName ?? null,
    });
    logAgentRunFinish({
      agentName: "Customer Reply Agent",
      runId,
      stepName: "run.finish",
      status: "complete",
      message: "Reply draft generated",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logAgentRunFinish({
      agentName: "Customer Reply Agent",
      runId,
      stepName: "run.finish",
      status: "failed",
      message,
      durationMs: Date.now() - startedAt,
    });
    const isConfig = /not configured/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 502 },
    );
  }
}
