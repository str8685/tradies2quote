import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { generateQuotePdf } from "@/lib/pdf-generator";
import { sendQuoteEmail } from "@/lib/email-quote";
import { uploadPdf } from "@/lib/quote-storage";
import { generatePublicToken } from "@/lib/quote-tokens";
import {
  SEND_ERROR_MESSAGES,
  validateQuoteForSending,
  type SendValidationError,
} from "@/lib/quote-validation";
import { formatCurrency, quoteNumber } from "@/lib/quote-defaults";
import type { QuoteData } from "@/lib/quote-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    acknowledged?: boolean;
  };
  const acknowledged = body?.acknowledged === true;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select(
      "id, user_id, status, quote_data, total_amount, currency, created_at, public_token, pdf_path, expires_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (qErr || !quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const qd = quote.quote_data as QuoteData | null;

  const validation = validateQuoteForSending({
    status: quote.status,
    total_amount: quote.total_amount,
    quote_data: qd,
    acknowledged,
  });
  if (!validation.ok) {
    // Validation failures are user-actionable (missing email, no line
    // items, takeoff-risk, etc.) so they're returned to the client below
    // with a human-readable message + structured reasons — no server log
    // needed. Errors that ARE server-side problems (PDF gen, upload,
    // email) still log via console.error so they surface in Vercel logs.
    return NextResponse.json(
      {
        error: validation.error,
        message: SEND_ERROR_MESSAGES[validation.error as SendValidationError],
        reasons: validation.reasons ?? [],
      },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, email, phone, address, logo_url")
    .eq("id", user.id)
    .maybeSingle();

  const quoteData = quote.quote_data as QuoteData;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = quote.public_token ?? generatePublicToken();
  const acceptUrl = `${appUrl}/quote/${token}`;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateQuotePdf({
      quoteId: quote.id,
      createdAt: quote.created_at,
      quote: quoteData,
      profile: profile ?? { business_name: null },
      acceptUrl,
    });
  } catch (e) {
    console.error("PDF generation failed", e);
    return NextResponse.json(
      { error: "pdf_generation_failed", message: "Could not generate the PDF." },
      { status: 500 },
    );
  }

  let pdfPath: string;
  try {
    pdfPath = await uploadPdf(quote.user_id, quote.id, pdfBytes);
  } catch (e) {
    console.error("PDF upload failed", e);
    return NextResponse.json(
      { error: "pdf_upload_failed", message: "Could not save the PDF." },
      { status: 500 },
    );
  }

  const number = quoteNumber(quote.id, quote.created_at);
  const totalText = formatCurrency(Number(quote.total_amount) || 0, quote.currency);

  // Persist the durable artifacts — PDF path, public token, expiry —
  // BEFORE the irreversible email send. If the email then fails, a
  // retry reuses the SAME token and PDF instead of minting a fresh
  // link the customer never receives; if this update itself fails,
  // nothing has been sent yet, so there is no inconsistency.
  const admin = adminClient();
  const expires_at =
    quote.expires_at ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: preErr } = await admin
    .from("quotes")
    .update({ pdf_path: pdfPath, public_token: token, expires_at })
    .eq("id", quote.id);
  if (preErr) {
    console.error("Quote pre-send update failed", preErr);
    return NextResponse.json(
      {
        error: "update_failed",
        message: "Could not save the quote before sending.",
      },
      { status: 500 },
    );
  }

  const emailResult = await sendQuoteEmail({
    to: validation.resolvedEmail,
    businessName: profile?.business_name || "Your business",
    clientName: quoteData.client.name,
    total: totalText,
    acceptUrl,
    quoteNumber: number,
    pdf: pdfBytes,
    pdfFileName: `${number}.pdf`,
  });
  if (!emailResult.ok) {
    // Token + PDF are already saved; status stays as-is so the tradie
    // can safely retry and reuse the same link.
    return NextResponse.json(
      {
        error: emailResult.error,
        message:
          emailResult.error === "email_not_configured"
            ? "Email is not configured. Set RESEND_API_KEY."
            : "Could not send the email. PDF was generated but not delivered.",
      },
      { status: emailResult.error === "email_not_configured" ? 503 : 502 },
    );
  }

  // Email is out — flip the status to sent.
  const { error: uErr } = await admin
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quote.id);
  if (uErr) {
    console.error("Quote status update failed", uErr);
    return NextResponse.json(
      {
        error: "update_failed",
        message: "Email sent but couldn't update quote status.",
      },
      { status: 500 },
    );
  }

  if (acknowledged) {
    console.log("[send-gate] takeoff override used", {
      quoteId: quote.id,
      channel: "email",
    });
  }
  await admin.from("quote_events").insert({
    quote_id: quote.id,
    type: "sent",
    metadata: {
      to: quoteData.client.email,
      ...(acknowledged ? { takeoff_override: true } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    public_token: token,
    accept_url: acceptUrl,
  });
}
