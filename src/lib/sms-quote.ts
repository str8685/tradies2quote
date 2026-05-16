import "server-only";

type SendArgs = {
  to: string;
  businessName: string;
  clientName: string;
  total: string;
  acceptUrl: string;
  quoteNumber: string;
};

export type SmsSendResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

export async function sendQuoteSms(args: SendArgs): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid) return { ok: false, error: "sms_not_configured" };
  if (!authToken) return { ok: false, error: "sms_token_not_configured" };
  if (!from) return { ok: false, error: "sms_from_not_configured" };

  const body = buildSmsBody(args);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    accountSid,
  )}/Messages.json`;

  const form = new URLSearchParams();
  form.set("To", args.to);
  form.set("From", from);
  form.set("Body", body);

  const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Twilio error", res.status, detail);
    return { ok: false, error: `sms_send_failed_${res.status}` };
  }
  const data = (await res.json().catch(() => null)) as { sid?: string } | null;
  return { ok: true, sid: data?.sid ?? "" };
}

export function buildSmsBody(args: Pick<SendArgs, "clientName" | "businessName" | "quoteNumber" | "total" | "acceptUrl">): string {
  const first = args.clientName.split(/\s+/)[0] || args.clientName;
  return `Hi ${first}, your quote ${args.quoteNumber} from ${args.businessName}: ${args.total}. View & accept: ${args.acceptUrl}`;
}
