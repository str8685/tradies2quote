/**
 * Photo / Plan Reading Agent — OpenAI Vision-backed.
 *
 * Takes an image (a phone photo of a wall, a sketched floor plan, a
 * sticker / spec label, an old drawing) and returns:
 *   • A plain-English description of what the model sees.
 *   • A list of likely materials / items it spotted, with explicit
 *     uncertainty flags.
 *   • A short "review flags" list — places where the model is unsure or
 *     where the human must measure on site.
 *
 * Critical safety rule: NEVER claim a measurement unless the image
 * literally contains a scale bar / tape / labelled dimension. The
 * model is instructed to say "approx" or "unknown" otherwise.
 *
 * Server-only. Needs OPENAI_API_KEY at runtime.
 */
import "server-only";

export interface PhotoPlanItem {
  /** Short label, e.g. "GIB plasterboard sheet (used)". */
  label: string;
  /** Where in the image (approx). E.g. "left wall, lower half". */
  location: string | null;
  /** Free-form note, condition, NZ trade context. */
  note: string | null;
  /** Confidence 0–1 the model assigned. */
  confidence: number;
  /** True = the item is a guess from visual context, not labelled. */
  ai_estimated: boolean;
}

export interface PhotoPlanResult {
  description: string;
  items: PhotoPlanItem[];
  /** Anything the human MUST measure or check on site. */
  reviewFlags: string[];
  /** Suggested quote-note text — paste-ready. */
  quoteNote: string;
}

export interface PhotoPlanInput {
  /** Image data, base64 (NOT a data URL). */
  imageBase64: string;
  /** MIME type, e.g. "image/jpeg". */
  mimeType: string;
  /** Optional context the user typed alongside the image. */
  hint?: string | null;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT = `You are an NZ-builder vision assistant. The user uploaded a photo or a sketched plan from a trade job.

Your job:
1. Describe what is in the image in plain English (2–4 sentences). NZ trade vocabulary preferred (GIB, H3.2, Pink Batts, Colorsteel, James Hardie).
2. List likely materials / fittings / items you spotted, each with:
   - confidence (0–1 you'd actually bet on it)
   - location (rough — "back wall", "top-left corner")
   - note (trade context: condition, replacement implications, treatment)
   - ai_estimated: true unless the image literally labels it
3. Add review flags whenever the human must measure or check on site:
   - No visible scale → can't quote dimensions
   - Possible asbestos / hazardous material
   - Load-bearing call needed
   - Hidden defect risk
4. Draft a "quoteNote" the tradie can paste into the quote — short, professional, NZ-builder voice, references the image.

CRITICAL: never claim a measurement (mm / m / m2) unless the image itself shows a scale bar, a tape measure, a labelled dimension, or a known-size reference (e.g. a standard 2400×1200 GIB sheet visibly intact). Default to "approx" or "unknown".

Output STRICT JSON only, no prose or code fences:
{
  "description": "...",
  "items": [{"label":"...","location":"...","note":"...","confidence":0.7,"ai_estimated":true}],
  "reviewFlags": ["..."],
  "quoteNote": "..."
}`;

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Max raw bytes accepted. Photos are usually 0.5–3 MB; cap at 8 MB. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function runPhotoPlanAgent(
  input: PhotoPlanInput,
): Promise<PhotoPlanResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!input.imageBase64 || input.imageBase64.length === 0) {
    throw new Error("Image is empty.");
  }
  if (!ALLOWED_MIME.has(input.mimeType.toLowerCase())) {
    throw new Error(`Unsupported image type: ${input.mimeType}`);
  }
  // Rough byte estimate from base64 length: bytes ≈ b64Length * 3/4.
  const approxBytes = Math.floor((input.imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (~${(approxBytes / 1024 / 1024).toFixed(1)} MB). Max 8 MB.`,
    );
  }

  const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;
  const userTextParts = [
    input.hint ? `Tradie note: ${input.hint}` : null,
    "Analyse the image and return the JSON described in the system prompt.",
  ].filter(Boolean) as string[];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userTextParts.join("\n\n") },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await res.json()) as OpenAIChatResponse;
  const raw = payload.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`OpenAI returned non-JSON: ${(e as Error).message}`);
  }
  const obj = parsed as Partial<PhotoPlanResult>;

  const items: PhotoPlanItem[] = Array.isArray(obj.items)
    ? obj.items.map((rec) => {
        const r = (rec ?? {}) as Partial<PhotoPlanItem>;
        const c = typeof r.confidence === "number" ? r.confidence : 0.5;
        return {
          label: typeof r.label === "string" ? r.label.trim() : "(unlabelled item)",
          location: typeof r.location === "string" ? r.location : null,
          note: typeof r.note === "string" ? r.note : null,
          confidence: c < 0 ? 0 : c > 1 ? 1 : c,
          ai_estimated: typeof r.ai_estimated === "boolean" ? r.ai_estimated : true,
        };
      })
    : [];

  return {
    description:
      typeof obj.description === "string" && obj.description.length > 0
        ? obj.description
        : "(model returned no description)",
    items,
    reviewFlags: Array.isArray(obj.reviewFlags)
      ? obj.reviewFlags.filter((s): s is string => typeof s === "string")
      : [],
    quoteNote:
      typeof obj.quoteNote === "string" && obj.quoteNote.length > 0
        ? obj.quoteNote
        : "(model returned no quote note)",
  };
}
