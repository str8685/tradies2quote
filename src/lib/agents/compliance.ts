/**
 * Compliance Agent — pure rule-based analyzer.
 *
 * Reads `quote_data` only; never writes. Returns a list of compliance
 * flags and a list of suggested clauses the user can copy into the
 * quote's exclusions / assumptions / terms. NZ-builder focused but
 * generic enough for AU/UK/US/CA.
 *
 * Safety:
 *   - Pure function. No I/O, no Anthropic, no Supabase.
 *   - Suggestions are static templates. The user must click an Apply
 *     button (copy to clipboard) before anything reaches the quote.
 *   - Disclaimer baked into the suggestion set: "Not legal advice".
 */
import type { QuoteData } from "@/lib/quote-types";

export type ComplianceSeverity = "info" | "warn" | "high";

export interface ComplianceFlag {
  id: string;
  severity: ComplianceSeverity;
  message: string;
  /** Where in the editor the user should look to fix it. */
  fixHint: string;
}

export interface ComplianceSuggestion {
  id: string;
  /** Where this clause belongs in the quote. */
  category: "exclusion" | "assumption" | "term";
  title: string;
  body: string;
}

export interface ComplianceReport {
  flags: ComplianceFlag[];
  suggestions: ComplianceSuggestion[];
  /** True if the quote content contains language the agent thinks is
   *  too definitive (guarantee, certify, etc.). */
  hasRiskyWording: boolean;
}

/** Words that often signal over-promising on a tradie quote. */
const RISKY_WORDS = [
  /\bguarantee(?:d|s)?\b/i,
  /\bcertif(?:y|ied|ication)\b/i,
  /\bwarrant(?:y|ies|ed)\b/i,
  /\bcomplete(?:ly)? watertight\b/i,
  /\bzero ?(?:cost|defect|risk)\b/i,
  /\b(?:never|always) fail\b/i,
];

const STANDARD_EXCLUSIONS: ComplianceSuggestion[] = [
  {
    id: "ex-consents",
    category: "exclusion",
    title: "Consents and council fees",
    body: "Excludes building consent, resource consent, council inspection fees, and any associated levies — these are arranged and paid directly by the client unless specifically agreed in writing.",
  },
  {
    id: "ex-hidden-defects",
    category: "exclusion",
    title: "Hidden defects",
    body: "Excludes remediation of hidden defects discovered once existing work is opened up (e.g. rot, borer, asbestos, faulty wiring, water damage). Any additional work required will be quoted separately before proceeding.",
  },
  {
    id: "ex-asbestos",
    category: "exclusion",
    title: "Asbestos and hazardous materials",
    body: "Excludes identification, testing, removal, or disposal of asbestos or other hazardous materials. If found, work pauses and the client engages a licensed removalist at their cost.",
  },
  {
    id: "ex-decoration",
    category: "exclusion",
    title: "Painting and decoration",
    body: "Excludes painting, wallpapering, and decorative finishes unless explicitly itemised in the quote.",
  },
  {
    id: "ex-electrical-plumbing",
    category: "exclusion",
    title: "Electrical and plumbing",
    body: "Excludes any electrical or plumbing work requiring a registered tradesperson unless explicitly itemised. These will be quoted by the appropriate licensed subcontractor.",
  },
];

const STANDARD_ASSUMPTIONS: ComplianceSuggestion[] = [
  {
    id: "as-site-access",
    category: "assumption",
    title: "Site access",
    body: "Assumes clear, safe access to the work area during agreed hours. Delays caused by restricted access (e.g. tenants, pets, deliveries) may incur additional charges at the agreed labour rate.",
  },
  {
    id: "as-weather",
    category: "assumption",
    title: "Weather delays",
    body: "Assumes acceptable working weather. Heavy rain, high winds, or extreme heat may delay outdoor work; rescheduled days are not chargeable but project completion may shift accordingly.",
  },
  {
    id: "as-power-water",
    category: "assumption",
    title: "Power and water",
    body: "Assumes the client provides usable power (240 V AC) and water at the site for the duration of the work.",
  },
  {
    id: "as-existing-substrate",
    category: "assumption",
    title: "Existing substrate condition",
    body: "Assumes existing framing, lining, and substrates are sound. Any remediation of underlying defects is excluded (see exclusions).",
  },
];

const STANDARD_TERMS: ComplianceSuggestion[] = [
  {
    id: "tm-validity",
    category: "term",
    title: "Quote validity",
    body: "This quote is valid for 30 days from the issue date. After that, materials prices may have moved and the quote may need to be re-issued.",
  },
  {
    id: "tm-variations",
    category: "term",
    title: "Variations",
    body: "Any change in scope must be agreed in writing before the change is carried out. Variations will be quoted separately and added to the final invoice.",
  },
  {
    id: "tm-deposit",
    category: "term",
    title: "Deposit and progress payments",
    body: "50% deposit on acceptance for jobs over $5,000. Progress payments for jobs over 2 weeks. Final payment due on practical completion.",
  },
  {
    id: "tm-late-payment",
    category: "term",
    title: "Late payment",
    body: "Accounts unpaid 14 days after invoice may attract a late-payment fee of 2% per month. Materials remain the contractor's property until the invoice is paid in full.",
  },
];

function joinNotes(quoteData: QuoteData): string {
  // Look across the writable text fields a tradie commonly types into
  // — these are where over-promising language sneaks in.
  const parts = [
    quoteData.job_summary ?? "",
    quoteData.terms ?? "",
    ...(quoteData.notes ?? []),
  ];
  return parts.join(" \n ").toLowerCase();
}

export function runComplianceAgent(
  quoteData: QuoteData | null,
): ComplianceReport {
  const flags: ComplianceFlag[] = [];

  if (!quoteData) {
    return { flags, suggestions: [], hasRiskyWording: false };
  }

  // Risky wording.
  const text = joinNotes(quoteData);
  const hits = RISKY_WORDS.filter((re) => re.test(text));
  const hasRiskyWording = hits.length > 0;
  if (hasRiskyWording) {
    flags.push({
      id: "risky-wording",
      severity: "warn",
      message: `Quote contains language that may sound like a guarantee (${hits.length} match${hits.length === 1 ? "" : "es"}).`,
      fixHint:
        "Soften absolute claims like 'guarantee', 'certified', 'warranty' to 'workmanship is to NZ Building Code'.",
    });
  }

  // Exclusions.
  const notesJoined = (quoteData.notes ?? []).join(" \n ");
  const hasExclusion = /exclud|exclu(s|d)|does not include|out of scope/i.test(
    notesJoined,
  );
  if (!hasExclusion) {
    flags.push({
      id: "no-exclusions",
      severity: "warn",
      message:
        "No exclusions listed — clients often query what is NOT covered.",
      fixHint: "Copy 1–2 standard exclusions from the suggestions below.",
    });
  }

  // Assumptions.
  if ((quoteData.notes ?? []).length === 0) {
    flags.push({
      id: "no-notes",
      severity: "info",
      message:
        "No site assumptions noted (access, weather, substrate, power).",
      fixHint:
        "A short list of assumptions protects you when conditions change.",
    });
  }

  // Variations / payment in terms.
  const terms = (quoteData.terms ?? "").toLowerCase();
  if (terms.length > 0 && !/variation|change/i.test(terms)) {
    flags.push({
      id: "no-variations-term",
      severity: "info",
      message:
        "Terms don't mention variations. Scope changes mid-job are common.",
      fixHint:
        "Add the standard variations clause from the suggestions below.",
    });
  }
  if (terms.length > 0 && !/deposit|progress|payment/i.test(terms)) {
    flags.push({
      id: "no-payment-term",
      severity: "warn",
      message: "Terms don't mention payment schedule.",
      fixHint:
        "Add the standard deposit and progress-payment clause from the suggestions below.",
    });
  }

  // Always suggest the standard set — the user can copy whichever apply.
  return {
    flags,
    suggestions: [
      ...STANDARD_EXCLUSIONS,
      ...STANDARD_ASSUMPTIONS,
      ...STANDARD_TERMS,
    ],
    hasRiskyWording,
  };
}
