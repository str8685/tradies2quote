import type { LibraryMaterial, QuoteProfile } from "./quote-types";
import { formatLibraryForPrompt } from "./materials";

const TRADIE_TERMS = `Common Whisper transcription mistakes — correct them silently when you spot them in the transcript:
- "jib" / "jib line" / "jib board" / "gibb" → "GIB" or "GIB-line" (NZ plasterboard brand)
- "ply" near "bracing" or "wall" → "plywood bracing" or "plywood lining"
- "h32" / "h three two" / "h three point two" → "H3.2" treated timber
- "h12" → "H1.2" treated timber; "h45" → "H4" or "H5" depending on context (in-ground use)
- "ninety by forty five" / "ninety by forty-five" → "90x45" timber dimensions
- "pink batts" → "Pink Batts" insulation
- "tantalised" / "tan" → treated pine
- "fascia" / "soffit" / "spouting" — keep NZ terms (do NOT change to "guttering")
- "macrocarpa" / "rimu" / "kwila" — NZ timber species, keep as-is
- "weatherboard" / "weatherboards" — NZ standard cladding term`;

const JSON_INSTRUCTIONS = `You MUST output ONLY a single valid JSON object. No prose, no markdown, no code fences, no explanation. Start your response with { and end with }.

The JSON object must match this exact shape:

{
  "client": {
    "name": string,                  // extract from transcript; if not mentioned, use "To be confirmed"
    "address": string | null,        // site address from transcript or null if not mentioned
    "email": string | null,          // client email if mentioned (must be a valid email format), else null
    "phone": string | null           // client phone if mentioned, else null
  },
  "job_summary": string,             // one sentence, plain English
  "line_items": [
    {
      "type": "material" | "labour" | "other",
      "description": string,         // e.g. "H3.2 90x45 framing pine"
      "quantity": number,            // numeric, can be fractional
      "unit": string,                // one of: "each", "m", "m²", "m³", "kg", "L", "hour", "day", "lot"
      "unit_price": number,          // pre-markup unit cost for materials, hourly rate for labour
      "line_total": number           // quantity * unit_price (markup is applied separately, NOT inside line_total)
    }
  ],
  "materials_subtotal": number,      // sum of material + other line_totals BEFORE markup
  "labour_subtotal": number,         // sum of labour line_totals
  "markup_pct": number,              // matches the profile (echo it back)
  "markup_amount": number,           // round(materials_subtotal * markup_pct / 100, 2)
  "subtotal_before_tax": number,     // materials_subtotal + markup_amount + labour_subtotal
  "tax_amount": number,              // round(subtotal_before_tax * tax_rate / 100, 2)
  "total": number,                   // subtotal_before_tax + tax_amount
  "currency": string,                // ISO code matching the profile
  "tax_label": string,               // matches the profile (e.g. "GST")
  "tax_rate": number,                // matches the profile (e.g. 15)
  "terms": string,                   // multi-line plain text — validity, deposit, payment, variations, exclusions
  "notes": string[]                  // bullet list of assumptions made and gaps the tradie should review (empty array if everything was clear)
}

Round all currency amounts to 2 decimal places.`;

const FINAL_VALIDATION = `FINAL VALIDATION — do this before returning:
Scan every value of line_items[].description and notes[]. Replace ALL of the following (case-insensitive, including inside larger words is OK to be conservative):
- "jib line" → "GIB-line"
- "jib board" → "GIB sheet"
- "jib" (standalone) → "GIB"
- "gibb" → "GIB"

After this scan, your output MUST NOT contain any lowercase "jib" or "gibb" anywhere. The string "GIB" or "GIB-line" should appear in their place.`;

export type BuildPromptOptions = {
  skipTakeoffMaterials?: boolean;
};

export function buildQuotePrompt(
  profile: QuoteProfile,
  library: LibraryMaterial[] = [],
  options: BuildPromptOptions = {},
): string {
  const skipTakeoffMaterials = options.skipTakeoffMaterials === true;
  const countryName =
    profile.country === "NZ"
      ? "New Zealand"
      : profile.country === "AU"
        ? "Australia"
        : profile.country === "UK"
          ? "United Kingdom"
          : profile.country === "US"
            ? "United States"
            : profile.country === "CA"
              ? "Canada"
              : profile.country;

  const libraryBlock = `THE TRADIE'S MATERIALS LIBRARY — use these prices and descriptions whenever a material in the job description matches an entry below:

${formatLibraryForPrompt(library, profile.currency)}

Library priority rules:
- For each material the tradie describes: if it clearly matches an entry above (same product, even if worded differently), USE the library's exact name as the line_item description and the library's price as unit_price.
- For materials NOT in the library, generate your best-guess unit_price based on typical ${countryName} retail pricing.
- Library prices are post-trade-discount but pre-markup; do not double-apply markup.`;

  const takeoffExclusionBlock = skipTakeoffMaterials
    ? `TAKEOFF MATERIALS ARE BEING CALCULATED SEPARATELY — DO NOT GENERATE THEM:
A deterministic takeoff calculator will produce all of the following materials and add them to the quote AFTER your response:
- Framing timber (90x45 SG8 studs, plates, nogs)
- 10mm GIB Board sheets, GIB screws, GIB adhesive
- Pink Batts insulation
- Skirting, architraves
- Framing nails

For this job, your line_items array MUST NOT include any of those. Generate ONLY:
- labour line items (one or more), priced at the default labour rate unless the transcript says otherwise
- non-takeoff materials such as paint, primer, sealants, fasteners that aren't framing nails, sandpaper, dropsheets, sundries, etc.
- "other" type items if relevant

If you list any of the excluded materials, the calculator will overwrite them — please do not waste tokens on them.`
    : "";

  return `You are a senior estimator helping a ${countryName} tradie produce a professional quote from a voice memo or typed description of a job.

The tradie's settings:
- Country: ${profile.country} (${countryName})
- Currency: ${profile.currency}
- Tax: ${profile.tax_label} at ${profile.tax_rate}% (apply to the post-markup subtotal)
- Default labour rate: ${profile.currency} ${profile.default_labour_rate}/hour (use unless the transcript specifies otherwise)
- Default materials markup: ${profile.default_markup_pct}% (apply ONLY to materials, not to labour)

${TRADIE_TERMS}

${libraryBlock}
${takeoffExclusionBlock ? `\n${takeoffExclusionBlock}\n` : ""}
Use ${countryName} spelling and trade vocabulary. Use realistic units (m, m², m³, kg, L, hour, day, each, lot).

Building the line items:
- Itemise materials separately, each with a realistic quantity, unit, and unit_price
- Add labour as separate line items (e.g. "Labour — strip existing siding") in "hour" units at the default rate
- Apply markup ONLY to materials (compute it as a separate top-level number, do NOT bake it into individual line_totals)
- Apply tax to the post-markup subtotal
- If a quantity, price, or detail is unclear, make a reasonable assumption AND add an entry to "notes" flagging it
- Never invent specifics that weren't implied — placeholders are fine when flagged in notes

Standard terms — include these unless the transcript suggests otherwise:
- Quote valid 30 days from issue
- 50% deposit required on acceptance for jobs over ${profile.currency} 5,000
- Final payment due on completion
- Variations to be agreed in writing before work proceeds
- Excludes consents and council fees unless specifically noted

${JSON_INSTRUCTIONS}

${FINAL_VALIDATION}`;
}
