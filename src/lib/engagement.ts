import "server-only";

/**
 * Engagement senders — automated review requests + quote follow-ups.
 *
 * Distinct from `lib/agents/followup.ts`, which only generates copy-paste
 * templates the tradie sends by hand. THESE functions actually send (via
 * Resend), but ONLY from the cron, ONLY for tradies who opted in
 * (feature_settings.auto_review_enabled / auto_followup_enabled), and ONLY
 * once per quote/step (dedup via the review_requests / quote_followups
 * ledgers). Flag-gated by REVIEWS_ENABLED / FOLLOWUPS_ENABLED, both off by
 * default, so nothing sends until switched on.
 */

const RESEND_URL = "https://api.resend.com/emails";

export function reviewsEnabled(): boolean {
  return process.env.REVIEWS_ENABLED === "true";
}

export function followupsEnabled(): boolean {
  return process.env.FOLLOWUPS_ENABLED === "true";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) return { ok: false, error: "email_not_configured" };
  if (!from) return { ok: false, error: "email_from_not_configured" };

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `email_send_failed_${res.status}:${detail.slice(0, 120)}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, messageId: data.id ?? null };
}

/** Post-job "leave us a review" email with the tradie's Google review link. */
export async function sendReviewRequestEmail(args: {
  to: string;
  clientName: string;
  businessName: string;
  reviewUrl: string;
}): Promise<SendResult> {
  const subject = `Thanks from ${args.businessName} — quick favour?`;
  const text = `Hi ${args.clientName},

Thanks for choosing ${args.businessName}! If you were happy with the work, a
quick review would mean a lot and helps other locals find us:

${args.reviewUrl}

Cheers,
${args.businessName}`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <p>Hi ${escapeHtml(args.clientName)},</p>
  <p>Thanks for choosing <strong>${escapeHtml(args.businessName)}</strong>! If you were happy with the work, a quick review would mean a lot and helps other locals find us.</p>
  <p style="margin: 24px 0;">
    <a href="${encodeURI(args.reviewUrl)}"
       style="display: inline-block; background: #FF5F15; color: #111; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 4px;">
      Leave a review
    </a>
  </p>
  <p style="color: #666; font-size: 13px;">If the button doesn't work, copy this link:<br>${escapeHtml(args.reviewUrl)}</p>
  <p style="color: #666; font-size: 13px; margin-top: 32px;">— ${escapeHtml(args.businessName)}</p>
</body></html>`;

  return sendEmail({ to: args.to, subject, text, html });
}

/** Gentle "just checking you got the quote" nudge with the accept link. */
export async function sendFollowupEmail(args: {
  to: string;
  clientName: string;
  businessName: string;
  quoteNumber: string;
  total: string;
  acceptUrl: string;
  step: number;
}): Promise<SendResult> {
  const subject =
    args.step >= 2
      ? `Still keen? Your quote from ${args.businessName}`
      : `Just checking — your quote from ${args.businessName}`;
  const text = `Hi ${args.clientName},

Just checking you got quote ${args.quoteNumber} (${args.total}) from ${args.businessName}.
Happy to tweak anything if you've got questions — you can review and accept it here:

${args.acceptUrl}

Cheers,
${args.businessName}`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <p>Hi ${escapeHtml(args.clientName)},</p>
  <p>Just checking you got quote <strong>${escapeHtml(args.quoteNumber)}</strong> (${escapeHtml(args.total)}) from <strong>${escapeHtml(args.businessName)}</strong>. Happy to tweak anything if you've got questions.</p>
  <p style="margin: 24px 0;">
    <a href="${args.acceptUrl}"
       style="display: inline-block; background: #FF5F15; color: #111; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 4px;">
      Review &amp; accept
    </a>
  </p>
  <p style="color: #666; font-size: 13px;">If the button doesn't work, copy this link:<br>${escapeHtml(args.acceptUrl)}</p>
  <p style="color: #666; font-size: 13px; margin-top: 32px;">— ${escapeHtml(args.businessName)}</p>
</body></html>`;

  return sendEmail({ to: args.to, subject, text, html });
}
