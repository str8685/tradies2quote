import "server-only";
import { fetchWithTimeout, TIMEOUTS } from "@/lib/fetchTimeout";

const RESEND_URL = "https://api.resend.com/emails";

/** Where beta feedback lands. Override via FEEDBACK_EMAIL; defaults to the founder. */
const FALLBACK_TO = "challis836@gmail.com";

type FeedbackEmailArgs = {
  fromTradieEmail: string;
  whatWorked: string;
  whatConfusing: string;
  wrongNumber: string;
  wouldPay: string;
  appVersion: string | null;
};

/**
 * Best-effort notification email when a tradie submits beta feedback. The
 * caller persists feedback to the DB first; this is a fire-and-forget nicety,
 * so it returns a result rather than throwing — a missing RESEND key just
 * no-ops (returns email_not_configured) without breaking the submission.
 */
export async function sendFeedbackEmail(
  args: FeedbackEmailArgs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) return { ok: false, error: "email_not_configured" };
  if (!from) return { ok: false, error: "email_from_not_configured" };
  const to = process.env.FEEDBACK_EMAIL || FALLBACK_TO;

  const row = (label: string, value: string) =>
    value
      ? `${label}\n${value}\n\n`
      : "";
  const text =
    `New beta feedback from ${args.fromTradieEmail}\n\n` +
    row("What worked?", args.whatWorked) +
    row("What was confusing?", args.whatConfusing) +
    row("Quote number that looked wrong?", args.wrongNumber) +
    row("Feature that would make them pay?", args.wouldPay) +
    (args.appVersion ? `\n— build ${args.appVersion}` : "");

  const htmlRow = (label: string, value: string) =>
    value
      ? `<p style="margin:16px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">${escapeHtml(
          label,
        )}</p><p style="margin:0;color:#111;white-space:pre-wrap;">${escapeHtml(
          value,
        )}</p>`
      : "";
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <p style="font-size:13px;color:#666;">New beta feedback from <strong>${escapeHtml(
    args.fromTradieEmail,
  )}</strong></p>
  ${htmlRow("What worked?", args.whatWorked)}
  ${htmlRow("What was confusing?", args.whatConfusing)}
  ${htmlRow("Quote number that looked wrong?", args.wrongNumber)}
  ${htmlRow("Feature that would make them pay?", args.wouldPay)}
  ${
    args.appVersion
      ? `<p style="margin-top:24px;color:#aaa;font-size:11px;">build ${escapeHtml(
          args.appVersion,
        )}</p>`
      : ""
  }
</body></html>`;

  const res = await fetchWithTimeout(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: args.fromTradieEmail,
      subject: `Beta feedback from ${args.fromTradieEmail}`,
      text,
      html,
    }),
  }, TIMEOUTS.email);

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Resend feedback error", res.status, detail);
    return { ok: false, error: `email_send_failed_${res.status}` };
  }
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
