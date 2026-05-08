export type QuoteItemType = "material" | "labour" | "other";

export type QuoteLineItem = {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

export type QuoteClient = {
  name: string;
  address: string | null;
  contact: string | null;
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
