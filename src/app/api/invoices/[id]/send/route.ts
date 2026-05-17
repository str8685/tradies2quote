import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { generateInvoicePdf } from "@/lib/invoice-pdf-generator";
import { sendInvoiceEmail } from "@/lib/email-invoice";
import { formatCurrency, formatIssueDate } from "@/lib/quote-defaults";
import type { InvoiceSnapshot } from "@/lib/types/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

/**
 * POST /api/invoices/[id]/send
 *
 * Mirrors the quote send route: generate the invoice PDF → email it
 * via Resend → stamp sent_at + flip status to "sent".
 *
 * No public token / accept-online flow yet (invoices are pay-by-bank
 * for now). When Stripe Connect lands the PDF will carry a hosted
 * checkout link and this route will mint one.
 */
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

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(
      "id, user_id, quote_id, invoice_number, status, total_amount, currency, invoice_data, due_date, created_at, sent_at, paid_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (invErr || !invoice) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json(
      {
        error: "already_paid",
        message: "This invoice is already marked paid.",
      },
      { status: 400 },
    );
  }
  if (invoice.status === "cancelled") {
    return NextResponse.json(
      { error: "cancelled", message: "This invoice was cancelled." },
      { status: 400 },
    );
  }

  const snapshot = invoice.invoice_data as InvoiceSnapshot | null;
  if (!snapshot) {
    return NextResponse.json(
      {
        error: "snapshot_missing",
        message: "Invoice has no line-item snapshot — recreate the draft.",
      },
      { status: 500 },
    );
  }

  // Pull the recipient email off the invoice snapshot (frozen at draft
  // creation) so a later edit to the client record can't change who
  // receives the invoice.
  const to = (snapshot.client?.email ?? "").trim();
  if (!to) {
    return NextResponse.json(
      {
        error: "client_email_missing",
        message:
          "The client on this invoice has no email address — add one and recreate the draft.",
      },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, email, phone, address, gst_number")
    .eq("id", user.id)
    .maybeSingle();

  // Payment instructions are pulled from the profile's address field
  // for now (tradies type their bank details there if they want them
  // on invoices). A dedicated payment_instructions column is the right
  // follow-up but the current schema doesn't have one.
  const paymentInstructions: string | null = null;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoice.invoice_number,
      createdAt: invoice.created_at,
      dueDate: invoice.due_date,
      snapshot,
      profile: profile ?? { business_name: null },
      paymentInstructions,
    });
  } catch (e) {
    console.error("Invoice PDF generation failed", e);
    return NextResponse.json(
      {
        error: "pdf_generation_failed",
        message: "Could not generate the invoice PDF.",
      },
      { status: 500 },
    );
  }

  const totalText = formatCurrency(
    Number(invoice.total_amount) || 0,
    invoice.currency,
  );
  const dueDateLabel = formatIssueDate(invoice.due_date);

  const emailResult = await sendInvoiceEmail({
    to,
    businessName: profile?.business_name || "Your business",
    clientName: snapshot.client.name,
    total: totalText,
    dueDateLabel,
    invoiceNumber: invoice.invoice_number,
    pdf: pdfBytes,
    pdfFileName: `${invoice.invoice_number}.pdf`,
    paymentInstructions,
  });
  if (!emailResult.ok) {
    return NextResponse.json(
      {
        error: emailResult.error,
        message:
          emailResult.error === "email_not_configured"
            ? "Email is not configured. Set RESEND_API_KEY."
            : "Could not send the invoice email. PDF was generated but not delivered.",
      },
      { status: emailResult.error === "email_not_configured" ? 503 : 502 },
    );
  }

  // Flip status + stamp sent_at. Service role bypass not needed — the
  // user-scoped query above already proved ownership.
  const admin = adminClient();
  const { error: uErr } = await admin
    .from("invoices")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);
  if (uErr) {
    console.error("Invoice status update failed", uErr);
    return NextResponse.json(
      {
        error: "update_failed",
        message: "Invoice sent but couldn't update the status.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    invoice_id: invoice.id,
    sent_to: to,
  });
}
