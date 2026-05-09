export type QuoteItemType = "material" | "labour" | "other";

export type QuoteLineItem = {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  library_id?: string | null;
  is_ai_estimated?: boolean;
  is_missing_price?: boolean;
  is_calculated_takeoff?: boolean;
  formula?: string;
  price_match_key?: string;
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
