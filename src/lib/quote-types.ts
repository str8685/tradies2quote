export type QuoteItemType = "material" | "labour" | "other";

export type PriceSource =
  | "user_library"
  | "catalogue_seed"
  | "csv_import"
  | "supplier_import"
  | "missing_price"
  | "ai_estimate";

export type PriceConfidence = "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Stage 5 — NZ Building Compliance Knowledge Layer.
//
// These types are inlined here (rather than imported from
// `src/lib/compliance/types.ts`) so that quote-types.ts has no
// dependency on the compliance module. This keeps the dependency
// direction one-way: compliance imports QuoteLineItem from this file,
// not the reverse.
//
// The fields are CRITICALLY server-side only — they are deliberately
// absent from `PublicLineItem`. The exact-6-field test in
// `materialMatchingPipeline.test.ts` will fail if anyone widens
// PublicLineItem to leak them, and `compliance/public-quote-stripping.test.ts`
// asserts the same invariant for the new fields specifically.
// ---------------------------------------------------------------------------

export type ComplianceConfidence = "high" | "medium" | "low";

/** Provenance of a per-line-item compliance decision. */
export type ComplianceProvenance =
  | "rule"
  | "catalogue"
  | "user_library"
  | "ai_estimate"
  | "missing_context";

/** Citation referencing a row in `compliance/sources.ts`. */
export type ComplianceCitation = {
  source_id: string;
  reason: string;
};

export type QuoteLineItem = {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  library_id?: string | null;
  /** Stage 4 catalogue row ID (mirrors library_id when both are set). */
  material_id?: string | null;
  is_ai_estimated?: boolean;
  is_missing_price?: boolean;
  is_calculated_takeoff?: boolean;
  formula?: string;
  price_match_key?: string;
  /** Stage 4 — where the unit_price came from. */
  price_source?: PriceSource;
  /** Stage 4 — confidence in the price match. */
  price_confidence?: PriceConfidence;
  /** Stage 5 — human-readable reason this line is on the quote. */
  reason?: string;
  /** Stage 5 — confidence in the compliance review for this line. */
  confidence?: ComplianceConfidence;
  /** Stage 5 — provenance of the compliance decision. */
  compliance_source_type?: ComplianceProvenance;
  /** Stage 5 — internal review notes (NEVER shown on the public quote). */
  compliance_notes?: string[];
  /** Stage 5 — confirmations the user must give before this line is safe. */
  required_confirmations?: string[];
  /** Stage 5 — citations to the approved-source knowledge base. */
  citations?: ComplianceCitation[];
};

export type TakeoffInputsSnapshot = Partial<{
  wallLengthM: number;
  wallHeightM: number;
  studSpacingMm: number;
  numberOfDoors: number;
  numberOfWindows: number;
  gibSides: 1 | 2;
  includeInsulation: boolean;
  includeSkirting: boolean;
  includeArchitraves: boolean;
  wastePercent: number;
}>;

export type LibraryMaterial = {
  id: string;
  name: string;
  unit: string | null;
  default_unit_price: number | null;
  supplier: string | null;
  supplier_url: string | null;
  notes: string | null;
  usage_count: number;
  is_ai_estimated: boolean;
  last_used_at: string | null;
};

export type QuoteClient = {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  contact?: string | null;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired";

export type QuoteEventType =
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired";

export type QuoteEvent = {
  id: string;
  quote_id: string;
  type: QuoteEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PublicLineItem = {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

export type PublicQuotePayload = {
  id: string;
  status: QuoteStatus;
  created_at: string;
  sent_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  accepted_quote_version: number;
  currency: string;
  has_pdf: boolean;
  has_signature: boolean;
  has_logo: boolean;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  client: {
    name: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  job_summary: string | null;
  line_items: PublicLineItem[];
  materials_subtotal: number;
  labour_subtotal: number;
  markup_amount: number;
  subtotal_before_tax: number;
  tax_amount: number;
  total: number;
  tax_label: string;
  tax_rate: number;
  terms: string | null;
};

export type QuoteData = {
  client: QuoteClient;
  job_summary: string;
  line_items: QuoteLineItem[];
  materials_subtotal: number;
  labour_subtotal: number;
  markup_pct: number;
  markup_amount: number;
  subtotal_before_tax: number;
  tax_amount: number;
  total: number;
  currency: string;
  tax_label: string;
  tax_rate: number;
  terms: string;
  notes: string[];
  takeoff_inputs?: TakeoffInputsSnapshot;
  /**
   * Stage 5 — server-side compliance review payload.
   *
   * Stored alongside the quote in the JSONB `quote_data` column so the
   * dashboard preview / future review panel can read it. NEVER returned
   * by the public-quote RPC `get_quote_by_token` — that RPC explicitly
   * projects only the customer-facing fields.
   *
   * The shape is `unknown` rather than `ComplianceReview` to avoid a
   * circular dependency between `quote-types.ts` and
   * `src/lib/compliance/`. Callers cast on read.
   */
  compliance_review?: unknown;
  /**
   * Stage 6 — server-side transcript layers (raw / cleaned / summary /
   * corrections / clarifications / confidence).
   *
   * Same privacy contract as `compliance_review`: stored in JSONB,
   * never returned by `get_quote_by_token`, never reachable from the
   * public quote page. Type is `unknown` to avoid a circular import
   * with `src/lib/transcriptCleanup.ts`. Callers cast on read.
   */
  transcript?: unknown;
};

export type QuoteProfile = {
  business_name: string | null;
  country: string;
  default_labour_rate: number;
  default_markup_pct: number;
  tax_label: string;
  tax_rate: number;
  currency: string;
};
