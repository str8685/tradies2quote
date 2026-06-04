import { NextResponse, type NextRequest } from "next/server";
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
    console.error("[payments/webhook] bad signature", e);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.payment_id;
      if (paymentId && session.payment_status === "paid") {
        const admin = adminClient();
        await admin
          .from("payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .eq("id", paymentId);
      }
    }
  } catch (e) {
    console.error("[payments/webhook] handler failed", e);
    // Return 200 so Stripe doesn't hammer retries for a non-signature error;
    // the row stays pending and can be reconciled.
    return NextResponse.json({ received: true, note: "handler_error" });
  }

  return NextResponse.json({ received: true });
}
