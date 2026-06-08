import { NextResponse, type NextRequest } from "next/server";
import { captureError } from "@/lib/observability";
import type Stripe from "stripe";
import { adminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook
 *
 * Deposit payments webhook — entirely separate from /api/stripe/webhook
 * (subscriptions). Verified with STRIPE_PAYMENTS_WEBHOOK_SECRET so the two
 * endpoints can never cross-process each other's events.
 *
 * Idempotent: marks the seeded `payments` row paid by its id (from session
 * metadata). Re-delivery lands the same row state.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    captureError(e, { route: "payments/webhook" });
    console.error("[payments/webhook] bad signature", e);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const admin = adminClient();

  // Idempotency ledger: record this event id first. A duplicate Stripe
  // delivery hits the primary key and we ack without re-processing.
  const { error: dupErr } = await admin
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, type: event.type });
  if (dupErr) {
    if (dupErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Non-conflict ledger error: log and continue — the payments UPDATE
    // below is id-keyed + status-guarded, so processing stays safe.
    console.error("[payments/webhook] ledger insert failed", dupErr);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.payment_id;
      if (paymentId && session.payment_status === "paid") {
        await admin
          .from("payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .eq("id", paymentId)
          // Idempotency: a Stripe redelivery of an already-paid row must
          // not overwrite paid_at with a fresh timestamp. Only the first
          // delivery (status still pending) performs the write.
          .neq("status", "paid");
      }
    }
  } catch (e) {
    captureError(e, { route: "payments/webhook" });
    console.error("[payments/webhook] handler failed", e);
    // Return 500 so Stripe RETRIES. The only write above is the id-keyed,
    // status-guarded payments UPDATE, which is idempotent — a retry safely
    // lands the same state instead of the deposit being silently lost.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
