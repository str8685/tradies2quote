/**
 * Wave 14 — Invoice types.
 *
 * Mirrors the `public.invoices` table created in migration
 * `wave14_invoices_table_and_rls`. Kept here (not inline with
 * `quote-types.ts`) so the invoice surface is self-contained and
 * future Wave 15 fields (sent_at/paid_at/email_sent_to/…) can land
 * without touching quote types.
 */
import type { QuoteData } from "@/lib/quote-types";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

/** Full row as it lives in `public.invoices`. */
export interface InvoiceRow {
  id: string;
  user_id: string;
  quote_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total_amount: number;
  tax_amount: number;
  subtotal: number;
  currency: string;
  invoice_data: InvoiceSnapshot;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  due_date: string;
  deleted_at: string | null;
}

/**
 * Slim projection the UI uses — what we SELECT for the dashboard +
 * quote preview without dragging the full jsonb snapshot down.
 */
export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total_amount: number;
  currency: string;
  due_date: string;
  created_at: string;
}

/**
 * What we snapshot into `invoice_data` jsonb at creation. Today this
 * mirrors `QuoteData` — invoices are "frozen quotes". When Wave 15+
 * adds invoice-specific fields (payment terms text, deposit, etc.)
 * this type widens but the existing rows stay backwards-compatible
 * because the column is jsonb.
 */
export type InvoiceSnapshot = QuoteData;

/**
 * Wave 14 — pure invoice agent output.
 *
 * Computed client-side from the quote, then either rendered as a
 * preview (if `reason === "ready"` the user can hit Create) or used
 * to show why the draft can't yet be made.
 */
export interface InvoiceDraftPreview {
  /** Display-only — the real number is generated server-side by the RPC. */
  invoiceNumberPreview: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  /** ISO. The RPC will set its own due_date — this is just for preview. */
  dueDateIso: string;
  clientName: string | null;
  lineItemCount: number;
  /** Why the preview is or isn't ready to create. */
  reason: "ready" | "quote-not-completed" | "quote-missing-data";
  /** Human-friendly things the user has to fix before creating. */
  blockers: string[];
}
