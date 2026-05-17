import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/stripe-client";

/**
 * The single source of truth for "what tier is this user on?"
 *
 * Three states the caller cares about:
 *   - `trialing` — within the free 7-day window after signup
 *   - `paid`    — has an active (or active-until-period-end) Stripe sub
 *   - `expired` — trial is over and no active subscription
 *
 * Used by:
 *   - /app/quotes/new — block if `expired`
 *   - <TrialBanner>  — show warning during last 2 days of trial
 *   - /app/upgrade   — show "you're already subscribed" if `paid`
 *   - Trial email cron — skip expiry emails for `paid`
 *
 * Trial start = `auth.users.created_at` (same anchor the trial-email
 * cron uses, kept consistent across the app). The 7-day trial length
 * is hard-coded — if it ever becomes a per-user value (e.g. extended
 * trials for partners), promote it to a column on profiles.
 */

const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionState = "trialing" | "paid" | "expired";

export interface SubscriptionStatus {
  state: SubscriptionState;
  /** When the trial ends (or ended). Always populated, even if user is
   *  on a paid plan — useful for "trial converted on day X" analytics. */
  trialEndsAt: Date;
  /** Days remaining in the trial. Negative if expired. Null if `paid`. */
  trialDaysLeft: number | null;
  /** When the paid subscription period ends. Only present if `paid`. */
  currentPeriodEnd: Date | null;
  /** Stripe customer id. Only present if user has ever started checkout. */
  stripeCustomerId: string | null;
  /** Raw Stripe status string ("active", "trialing", "past_due", etc).
   *  null when user has never started a subscription. */
  stripeSubscriptionStatus: string | null;
}

/**
 * Read the user's status. Single Supabase round-trip — pulls auth user
 * created_at AND any subscriptions row in one query path.
 *
 * `signedUpAt` is the trial anchor (auth.users.created_at). The caller
 * usually has the user object already; pass it in to save a round-trip.
 */
export async function getSubscriptionStatus(args: {
  userId: string;
  signedUpAt: Date;
}): Promise<SubscriptionStatus> {
  const { userId, signedUpAt } = args;
  const trialEndsAt = new Date(signedUpAt.getTime() + TRIAL_DAYS * DAY_MS);
  const now = new Date();
  const trialMsLeft = trialEndsAt.getTime() - now.getTime();
  const trialDaysLeft = Math.ceil(trialMsLeft / DAY_MS);
  const inTrial = trialMsLeft > 0;

  // No Stripe configured = everyone is on a permanent trial. Lets the
  // app run end-to-end during development before keys are wired.
  if (!isStripeConfigured()) {
    return {
      state: inTrial ? "trialing" : "trialing", // permanent trial
      trialEndsAt,
      trialDaysLeft: inTrial ? trialDaysLeft : 0,
      currentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionStatus: null,
    };
  }

  const admin = adminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select(
      "stripe_customer_id, stripe_subscription_id, status, current_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const subStatus = sub?.status ?? null;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end)
    : null;

  // Stripe statuses that mean "user has access right now":
  //   - active   : paying normally
  //   - trialing : Stripe-managed trial (we don't use this — we manage
  //     trial ourselves — but treat it as paid if it ever appears)
  //   - past_due : retry-in-progress; let them in for now, the retry
  //     either succeeds or cancels the subscription
  // Everything else (canceled, unpaid, incomplete, incomplete_expired,
  // paused) loses access immediately.
  const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
  const hasActiveSub =
    subStatus !== null &&
    ACTIVE_STATUSES.has(subStatus) &&
    // If the period has ended and Stripe hasn't bumped us yet, treat
    // as expired so the user can't slip through a webhook delay.
    (!periodEnd || periodEnd.getTime() > now.getTime());

  if (hasActiveSub) {
    return {
      state: "paid",
      trialEndsAt,
      trialDaysLeft: null,
      currentPeriodEnd: periodEnd,
      stripeCustomerId: sub?.stripe_customer_id ?? null,
      stripeSubscriptionStatus: subStatus,
    };
  }

  return {
    state: inTrial ? "trialing" : "expired",
    trialEndsAt,
    trialDaysLeft,
    currentPeriodEnd: periodEnd,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionStatus: subStatus,
  };
}

/** Convenience: can the user create new quotes / use write features? */
export function canWrite(status: SubscriptionStatus): boolean {
  return status.state !== "expired";
}

/** Convenience: should we show the "your trial ends soon" banner? */
export function shouldShowTrialBanner(status: SubscriptionStatus): boolean {
  return (
    status.state === "trialing" &&
    status.trialDaysLeft !== null &&
    status.trialDaysLeft <= 2
  );
}
