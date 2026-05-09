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
  _request: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
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
    .single();
  if (qErr || !quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const qd = quote.quote_data as QuoteData | null;
  const debugClient = qd?.client ?? null;
  console.log("[send-quote] inspect", {
    quote_id: quote.id,
    status: quote.status,
    has_quote_data: qd !== null,
    has_line_items: Array.isArray(qd?.line_items) && qd.line_items.length > 0,
    line_item_count: qd?.line_items?.length ?? 0,
    total_amount: quote.total_amount,
    client_name: debugClient?.name ?? null,
    client_email_present: !!(debugClient?.email && debugClient.email.trim().length > 0),
    client_phone_present: !!(debugClient?.phone && debugClient.phone.trim().length > 0),
    legacy_contact_present: !!(debugClient?.contact && debugClient.contact.trim().length > 0),
  });

  const validation = validateQuoteForSending({
    status: quote.status,
    total_amount: quote.total_amount,
    quote_data: qd,
  });
  if (!validation.ok) {
    console.log("[send-quote] validation_failed", {
      quote_id: quote.id,
      error: validation.error,
    });
    return NextResponse.json(
      {
        error: validation.error,
        message: SEND_ERROR_MESSAGES[validation.error as SendValidationError],
      },
      { status: 400 },
    );
  }
  console.log("[send-quote] validation_ok", { quote_id: quote.id });

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

  // Update quote: status=sent, sent_at, pdf_path, public_token (if minted), expires_at default
  const admin = adminClient();
  const expires_at =
    quote.expires_at ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: uErr } = await admin
    .from("quotes")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      pdf_path: pdfPath,
      public_token: token,
      expires_at,
    })
    .eq("id", quote.id);
  if (uErr) {
    console.error("Quote update failed", uErr);
    return NextResponse.json(
      { error: "update_failed", message: "Email sent but couldn't update quote status." },
      { status: 500 },
    );
  }

  await admin
    .from("quote_events")
    .insert({ quote_id: quote.id, type: "sent", metadata: { to: quoteData.client.email } });

  return NextResponse.json({
    ok: true,
    public_token: token,
    accept_url: acceptUrl,
  });
}
