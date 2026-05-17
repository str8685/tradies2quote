import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isStripeConfigured, stripeClient } from "@/lib/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 *
 * Mints a Stripe Customer Portal session for the current user and
 * returns its hosted URL. The portal is where users update their
 * card, view invoices, and cancel — Stripe hosts the whole flow so
 * we never see PCI data.
 *
 * Prerequisite: the user must already be (or have been) a Stripe
 * customer. If not, return 404 so the UI can hide the link instead
 * of showing a broken button.
 */
export async function POST(_request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      {
        error: "no_customer",
        message:
          "You don't have a Stripe customer yet — subscribe first to manage your billing.",
      },
      { status: 404 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://tradies2quote.com";

  const stripe = stripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/app/settings`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
