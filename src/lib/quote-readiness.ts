/**
 * Quote-readiness check.
 *
 * Pure function — given a quote row + the user's profile, returns a
 * list of readiness items the UI renders as a checklist. No I/O, no
 * server access, no side effects, so it's safe to import from both
 * server and client components.
 *
 * Three statuses per item:
 *   - "complete" — value is present + non-empty
 *   - "warning"  — value is missing but not strictly required to send
 *   - "missing"  — value is missing AND strictly required to send
 *
 * The aggregate `summarize()` helper rolls the items into a single
 * banner status (`ready` / `review` / `missing`). "Ready" only when
 * every required item is complete AND no warnings remain. "Review" is
 * the soft-warn state. "Missing" only when at least one required item
 * is missing — the UI uses this to colour the banner red but, per the
 * Wave 11 brief, does NOT block sending.
 */
import type { QuoteData } from "@/lib/quote-types";

export type ReadinessStatus = "complete" | "warning" | "missing";

export interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail?: string;
}

export interface ReadinessSummary {
  status: "ready" | "review" | "missing";
  ready: number;
  review: number;
  missing: number;
  total: number;
}

/** Minimal shape of the user's profile row needed for readiness. */
export interface ProfileForReadiness {
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

function isNonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Build the readiness list for one quote.
 *
 * `quoteData` may be null when the quote is still pre-generation; that
 * case maps every field to "missing".
 */
export function checkQuoteReadiness(
  quoteData: QuoteData | null,
  profile: ProfileForReadiness | null,
  expiresAt: string | null,
): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  // Client name — required.
  const clientName = quoteData?.client?.name ?? null;
  items.push({
    id: "client_name",
    label: "Client name",
    status:
      isNonEmpty(clientName) && clientName !== "To be confirmed"
        ? "complete"
        : "missing",
    detail:
      isNonEmpty(clientName) && clientName !== "To be confirmed"
        ? undefined
        : "Add the client's name before sending.",
  });

  // Job / site address — required (client.address fallback).
  const jobAddress = quoteData?.client?.address ?? null;
  items.push({
    id: "client_address",
    label: "Job address",
    status: isNonEmpty(jobAddress) ? "complete" : "warning",
    detail: isNonEmpty(jobAddress)
      ? undefined
      : "Site address is empty — fine for service calls, recommended otherwise.",
  });

  // Scope / job summary — required.
  const jobSummary = quoteData?.job_summary ?? null;
  items.push({
    id: "scope",
    label: "Scope (job summary)",
    status: isNonEmpty(jobSummary) ? "complete" : "missing",
    detail: isNonEmpty(jobSummary)
      ? undefined
      : "Add a one-line scope summary.",
  });

  // Materials — at least one materials line.
  const lineItems = quoteData?.line_items ?? [];
  const hasMaterials = lineItems.some((it) => it.type === "material");
  items.push({
    id: "materials",
    label: "Materials",
    status: hasMaterials ? "complete" : "warning",
    detail: hasMaterials
      ? undefined
      : "No materials lines — fine for labour-only quotes.",
  });

  // Labour — at least one labour line.
  const hasLabour = lineItems.some((it) => it.type === "labour");
  items.push({
    id: "labour",
    label: "Labour",
    status: hasLabour ? "complete" : "warning",
    detail: hasLabour
      ? undefined
      : "No labour lines — fine for materials-only quotes.",
  });

  // GST — tax rate set on quote.
  const taxRate = quoteData?.tax_rate ?? 0;
  items.push({
    id: "gst",
    label: "GST / tax",
    status: taxRate > 0 ? "complete" : "warning",
    detail:
      taxRate > 0
        ? undefined
        : "Tax rate is 0% — check this matches the job.",
  });

  // Total — must be > 0.
  const total = quoteData?.total ?? 0;
  items.push({
    id: "total",
    label: "Total amount",
    status: total > 0 ? "complete" : "missing",
    detail: total > 0 ? undefined : "Quote total is 0 — add line items.",
  });

  // Exclusions — at least one note line that reads like an exclusion.
  const notes = quoteData?.notes ?? [];
  const hasExclusions = notes.some((n) =>
    /exclud|exclu(s|d)|does not include/i.test(n),
  );
  items.push({
    id: "exclusions",
    label: "Exclusions",
    status: hasExclusions ? "complete" : "warning",
    detail: hasExclusions
      ? undefined
      : "Add at least one exclusion so the client knows what is out of scope.",
  });

  // Assumptions — any note covers it.
  const hasAssumptions =
    notes.length > 0 ||
    isNonEmpty((quoteData as unknown as { takeoff_inputs?: unknown })?.takeoff_inputs as string);
  items.push({
    id: "assumptions",
    label: "Assumptions",
    status: hasAssumptions ? "complete" : "warning",
    detail: hasAssumptions
      ? undefined
      : "Note any access, finish, or takeoff assumptions so they're not surprises.",
  });

  // Valid until — quote-level expires_at column.
  items.push({
    id: "valid_until",
    label: "Valid until",
    status: isNonEmpty(expiresAt) ? "complete" : "warning",
    detail: isNonEmpty(expiresAt)
      ? undefined
      : "No expiry — most NZ tradies quote 30 days.",
  });

  // Payment terms — `terms` is a free-text field on QuoteData.
  const terms = quoteData?.terms ?? "";
  items.push({
    id: "payment_terms",
    label: "Payment terms",
    status: isNonEmpty(terms) ? "complete" : "warning",
    detail: isNonEmpty(terms)
      ? undefined
      : "Payment terms are empty — clients often ask for these in writing.",
  });

  // Business contact details — at minimum business_name + (email or phone).
  const hasContact =
    isNonEmpty(profile?.business_name) &&
    (isNonEmpty(profile?.email) || isNonEmpty(profile?.phone));
  items.push({
    id: "business_contact",
    label: "Your business contact details",
    status: hasContact ? "complete" : "missing",
    detail: hasContact
      ? undefined
      : "Fill in business name + email or phone in Settings.",
  });

  return items;
}

/** Tally the items into a single banner status. */
export function summarizeReadiness(items: ReadinessItem[]): ReadinessSummary {
  let ready = 0;
  let review = 0;
  let missing = 0;
  for (const item of items) {
    if (item.status === "complete") ready += 1;
    else if (item.status === "warning") review += 1;
    else missing += 1;
  }
  const total = items.length;
  const status: ReadinessSummary["status"] =
    missing > 0 ? "missing" : review > 0 ? "review" : "ready";
  return { status, ready, review, missing, total };
}
