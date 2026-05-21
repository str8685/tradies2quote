import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canWrite, getSubscriptionStatus } from "@/lib/subscription";
import { isOwnerEmail } from "@/lib/owner";
import { parseSupplierQuoteExtraction } from "@/lib/materials/quoteExtraction";

/**
 * POST /api/materials/extract-quote
 *
 * Body: multipart/form-data with an `image` file (a photo of a NZ
 * building-merchant quote / invoice). Returns the extracted line items
 * for the tradie to REVIEW before anything is written to their library:
 *
 *   200 { supplier, currency, gst_inclusive, items[], notes[] }
 *   400 bad/missing image · 401 unauth · 402 trial expired
 *   413 too big · 415 wrong type · 429 daily limit · 502/503 upstream
 *
 * The AI only extracts. The write happens later via the
 * `importSupplierQuoteItems` server action, after the human confirms.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vision over a dense quote photo can take 20-40s. Match scan-drawing.
export const maxDuration = 60;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
// A quote can list 30-40 lines; each JSON row is ~40 tokens. 8192 keeps
// headroom so a long quote doesn't truncate mid-array.
const MAX_TOKENS = 8192;

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// Daily AI cap per user — same in-memory pattern as /api/suppliers/extract.
// Cheap (no DB write), per-instance, owner-bypassed for dogfooding.
const DAILY_LIMIT = 20;
const usageBuckets = new Map<string, { count: number; resetAt: number }>();

function checkAndCountUsage(
  userId: string,
): { ok: true } | { ok: false; resetAt: number } {
  const now = Date.now();
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(24, 0, 0, 0);
  const resetAt = utcMidnight.getTime();

  const bucket = usageBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    usageBuckets.set(userId, { count: 1, resetAt });
    return { ok: true };
  }
  if (bucket.count >= DAILY_LIMIT) {
    return { ok: false, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { ok: true };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

const SYSTEM_PROMPT = `You read a photo of a NEW ZEALAND building-supplier quote, invoice or order (e.g. ITM, PlaceMakers, Mitre 10 Trade, Bunnings, Carters, Bunnings Trade). Extract each product line so the prices can go into a tradie's price library.

Return STRICT JSON only — no prose, no markdown, no code fences:
{
  "supplier": string | null,
  "quote_number": string | null,
  "currency": string | null,
  "gst_inclusive": boolean | null,
  "items": [
    {
      "name": string,
      "unit": string,
      "quantity": number | null,
      "pieces": number | null,
      "price": number | null,
      "line_total": number | null,
      "sku": string | null,
      "raw_text": string | null,
      "confidence": number
    }
  ],
  "subtotal": number | null,
  "gst": number | null,
  "total": number | null,
  "notes": string[]
}

Field rules:
- "supplier": the merchant's name if shown (e.g. "ITM"), else null.
- "quote_number": the quote / order / reference number as printed, else null.
- "currency": e.g. "NZD" if shown, else null.
- "gst_inclusive": true if the UNIT prices shown INCLUDE GST, false if they EXCLUDE GST, null if you can't tell. NZ trade quotes are usually GST-exclusive.
- "name": the product description as printed.
- "unit": each, m, m², m³, sheet, length, bag, box, kg, pair, roll … default "each".
- "quantity": the line quantity in the SAME unit as the unit price, so that quantity × price = the line total printed on the quote. null if not shown.
- "pieces": when the line shows an "N/length" breakdown (e.g. "19/4.8m" = 19 lengths), the piece count (19), else null.
- "price": the UNIT price (price for ONE unit), as a number, no "$" or commas. If the line only shows a quantity and a line total, divide total by quantity to get the unit price and LOWER the confidence. null if there is no usable price.
- "line_total": the line total EXACTLY as printed on that row (no "$"/commas). Capture what is printed — do NOT compute or correct it. null if no per-line total is shown. (This is the source value the app reconciles against; the app recomputes its own total separately.)
- "sku": the product/SKU/order code if printed, else null.
- "raw_text": the row's text as you read it (e.g. "19/4.8m H3.2 140x45 @ 12.40 = 235.60"), for review provenance. null if unsure.
- "confidence": 0..1 — your confidence in this row. Lower it when the text is unclear or you derived the unit price.
- "subtotal" / "gst" / "total": the document summary amounts EXACTLY as printed (no "$"/commas), else null. Capture them — do NOT compute or correct them.
- "notes": short strings for anything the tradie should double-check (smudged numbers, ambiguous units, lines you skipped).

Hard rules:
- Extract BOTH the unit price ("price") AND the printed line total ("line_total") for each row — capture them exactly, never compute or "fix" a printed number.
- Capture the printed summary amounts in "subtotal", "gst" and "total". Do NOT include subtotal/GST/total/rounding rows as product items in "items".
- Do NOT invent products or numbers. If you cannot read a value, use null and add a note — never guess.
- Keep a freight/delivery line as an item only if it's a real chargeable line.
- Use NZ trade vocabulary.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscriptionStatus({
    userId: user.id,
    signedUpAt: new Date(user.created_at ?? Date.now()),
    email: user.email,
  });
  if (!canWrite(sub)) {
    return NextResponse.json(
      {
        error: "trial_expired",
        message:
          "Your free trial has ended. Subscribe to keep scanning supplier quotes.",
        upgrade_url: "/app/upgrade",
      },
      { status: 402 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Quote scanning is not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  if (!isOwnerEmail(user.email)) {
    const limit = checkAndCountUsage(user.id);
    if (!limit.ok) {
      const hoursUntilReset = Math.max(
        1,
        Math.ceil((limit.resetAt - Date.now()) / (60 * 60 * 1000)),
      );
      return NextResponse.json(
        {
          error: `Daily AI limit reached. Resets in about ${hoursUntilReset}h. Add materials manually until then, or get in touch if this seems wrong.`,
          resetAt: new Date(limit.resetAt).toISOString(),
        },
        { status: 429 },
      );
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an 'image' field." },
      { status: 400 },
    );
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'image' file field." },
      { status: 400 },
    );
  }
  if (image.size === 0) {
    return NextResponse.json({ error: "Image file is empty." }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)} MB limit.` },
      { status: 413 },
    );
  }
  const mime = (image.type || "").toLowerCase();
  if (!ACCEPTED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${image.type || "unknown"}.` },
      { status: 415 },
    );
  }

  const arrayBuf = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const mediaType = mime === "image/jpg" ? "image/jpeg" : mime;

  let claudeRes: Response;
  try {
    claudeRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Read every product line on this supplier quote and return the JSON described in the system prompt.",
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error("extract-quote fetch failed", err);
    return NextResponse.json(
      { error: "Network error contacting the scan model. Please try again." },
      { status: 502 },
    );
  }

  if (!claudeRes.ok) {
    const detail = await claudeRes.text().catch(() => "");
    console.error(
      `ANTHROPIC_${claudeRes.status} ${MODEL} ${detail.slice(0, 120).replace(/\s+/g, " ")}`,
    );
    return NextResponse.json(
      { error: "Quote scan failed. Please try again.", upstream_status: claudeRes.status },
      { status: 502 },
    );
  }

  let payload: AnthropicResponse;
  try {
    payload = (await claudeRes.json()) as AnthropicResponse;
  } catch {
    console.error("extract-quote returned non-JSON 200 body");
    return NextResponse.json(
      { error: "Quote scan failed. Please try again." },
      { status: 502 },
    );
  }

  if (payload.stop_reason === "max_tokens") {
    return NextResponse.json(
      {
        error:
          "That quote had too many lines to read in one go. Try photographing it in two halves.",
      },
      { status: 502 },
    );
  }

  const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
  const fullJson = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let raw: unknown;
  try {
    raw = JSON.parse(fullJson);
  } catch (e) {
    console.error(
      "extract-quote failed to parse JSON",
      e,
      "raw (first 400):",
      fullJson.slice(0, 400),
    );
    return NextResponse.json(
      { error: "Couldn't read that quote. Try a sharper, flatter photo." },
      { status: 502 },
    );
  }

  const parsed = parseSupplierQuoteExtraction(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Couldn't read that quote. Try a sharper, flatter photo." },
      { status: 502 },
    );
  }

  if (parsed.value.items.length === 0) {
    return NextResponse.json(
      {
        error:
          "No product lines found. Make sure the whole quote is in frame and in focus.",
      },
      { status: 422 },
    );
  }

  console.log("[extract-quote] ok", {
    userId: user.id,
    supplier: parsed.value.supplier,
    items: parsed.value.items.length,
  });

  return NextResponse.json(parsed.value);
}
