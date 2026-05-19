import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canWrite, getSubscriptionStatus } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Claude vision — Sonnet 4 is what the rest of the quote pipeline uses
// (see src/app/api/quotes/generate/route.ts), so the read of the
// drawing and the line-item planner downstream see the same model.
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2048;

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// The scan turns the drawing into the SAME shape of input the
// voice/type flow already produces: a plain-English, dimension-rich
// job description. Downstream, /api/quotes/generate parses it into
// line items (and the takeoff calculator can pick up framing / deck /
// cladding patterns automatically). That means scan-drawing piggybacks
// on all the existing material-matching, pricing, library, compliance
// and review tooling — no separate quote pipeline to maintain.
const SYSTEM_PROMPT = `You are an NZ-builder takeoff reader. The user uploaded a photo or scan of a hand-drawn construction plan/sketch (deck, fence, framing, retaining wall, shed, deck steps, cladding plan, etc).

Your job: read every annotation on the drawing and produce a single, dense, plain-English JOB DESCRIPTION that a quoting AI can turn into materials and labour.

Read out, in order:
1. WHAT IS BEING BUILT (deck, fence, gib wall, retaining wall, garage slab, …). One short phrase.
2. PRIMARY DIMENSIONS — every length/width/height/depth on the drawing, in millimetres or metres exactly as written. If a dimension is in mm, restate it in metres too (e.g. "8820mm = 8.82m"). If there are step heights, riser/going, post heights, pile depths, fastener spacings — call them out.
3. STRUCTURAL ELEMENTS — for each one, list the size, treatment, spacing and count. Examples:
   - "12 posts at 125x125 H5, set 1.8m into concrete footings"
   - "Joists 140x45 H3.2 at 450mm centres, spanning 4.02m"
   - "Bearers 190x45 H3.2"
   - "Decking 140x19 (or 140x45 if specified) at 6m lengths"
   - "Top and bottom plates 90x45 H1.2, studs at 600mm centres"
4. FIXINGS / FASTENERS / HARDWARE — joist hangers, post anchors, stainless decking screws, framing nails, coach screws.
5. CONCRETE / BAGS — count the holes / pads / piles and note hole size if shown so the quoter can work out bag count (20kg bag covers ~0.01m³).
6. ACCESSORIES — handrails, steps, balustrades, gates, infill, ducting if shown.
7. EXPLICIT NOTES THE TRADIE WROTE — quote any text labels on the drawing word-for-word (these are often important: "use H5 in ground", "match existing", "no balustrade").
8. ASSUMPTIONS YOU MADE because the drawing was ambiguous. Flag these clearly with "Assumed:".
9. WHAT THE DRAWING DOES NOT SHOW — call out missing info the tradie should add (waste %, finish, accessibility, ground conditions).

CRITICAL rules:
- DO NOT invent dimensions. If a number is not on the drawing, do not write one. Say "not shown".
- Use NZ trade vocabulary: GIB, H1.2 / H3.2 / H4 / H5 treated pine, 90x45, 140x45, 140x19 decking, Pink Batts, joist hangers, post anchors, stainless decking screws.
- Keep units explicit. mm or m, not "8.8" by itself.
- This text will be fed straight to another LLM, so be terse and structured, NOT chatty.
- Output STRICT JSON only — no prose, no markdown, no code fences.

Output shape:
{
  "buildType": string,
  "summary": string,
  "transcript": string
}

Where:
- "buildType" is a short noun phrase ("Timber deck", "1.8m boundary fence", "Garage GIB lining", …).
- "summary" is one sentence (under 200 chars) for log lines.
- "transcript" is the full structured takeoff text described above — the tradie will be able to review/edit it before the quote is generated. Aim for 200–800 words. Use newlines between sections, plain prose inside each section.`;

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

interface ScanPayload {
  buildType: string;
  summary: string;
  transcript: string;
}

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
          "Your free trial has ended. Subscribe to keep scanning drawings.",
        upgrade_url: "/app/upgrade",
      },
      { status: 402 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Drawing scan is not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
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
      {
        error: `Image exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)} MB limit.`,
      },
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

  const hintRaw = form.get("hint");
  const hint =
    typeof hintRaw === "string" && hintRaw.trim().length > 0
      ? hintRaw.trim().slice(0, 500)
      : null;

  const arrayBuf = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const mediaType = mime === "image/jpg" ? "image/jpeg" : mime;

  const userTextParts: string[] = [];
  if (hint) {
    userTextParts.push(`Tradie note about this drawing: ${hint}`);
  }
  userTextParts.push(
    "Read every annotation on this hand-drawn plan and return the JSON described in the system prompt.",
  );

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
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              { type: "text", text: userTextParts.join("\n\n") },
            ],
          },
          { role: "assistant", content: "{" },
        ],
      }),
    });
  } catch (err) {
    console.error("scan-drawing fetch failed", err);
    return NextResponse.json(
      { error: "Network error contacting drawing model. Please try again." },
      { status: 502 },
    );
  }

  if (!claudeRes.ok) {
    const detail = await claudeRes.text().catch(() => "");
    console.error("scan-drawing Claude API error", claudeRes.status, detail.slice(0, 400));
    return NextResponse.json(
      { error: "Drawing scan failed. Please try again." },
      { status: 502 },
    );
  }

  let payload: AnthropicResponse;
  try {
    payload = (await claudeRes.json()) as AnthropicResponse;
  } catch {
    console.error("scan-drawing returned non-JSON 200 body");
    return NextResponse.json(
      { error: "Drawing scan failed. Please try again." },
      { status: 502 },
    );
  }

  if (payload.stop_reason === "max_tokens") {
    return NextResponse.json(
      {
        error:
          "Drawing was too detailed to scan in one go. Try a tighter crop, or split it across two scans.",
      },
      { status: 502 },
    );
  }

  const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
  const fullJson = "{" + text;

  let parsed: ScanPayload;
  try {
    parsed = JSON.parse(fullJson) as ScanPayload;
  } catch (e) {
    console.error(
      "scan-drawing failed to parse JSON",
      e,
      "raw (first 400):",
      fullJson.slice(0, 400),
    );
    return NextResponse.json(
      { error: "Drawing scan response was malformed. Please try again." },
      { status: 502 },
    );
  }

  const transcript = (parsed.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "Couldn't read anything off that drawing. Try a clearer photo." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    transcript,
    buildType:
      typeof parsed.buildType === "string" ? parsed.buildType.trim() : "",
    summary:
      typeof parsed.summary === "string" ? parsed.summary.trim() : "",
  });
}
