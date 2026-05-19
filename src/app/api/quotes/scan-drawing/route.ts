import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canWrite, getSubscriptionStatus } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Wave 42 (rollback) — bringing scan-drawing back to Sonnet 4 after
// the Opus 4.7 model ID `claude-opus-4-7` was rejected by the public
// Anthropic API. The exact Opus ID needs to be looked up against
// docs.anthropic.com/en/docs/about-claude/models before re-trying.
// Sonnet vision is still strong; the upgrade was a polish step, not
// a fix for a broken feature.
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

const JOB_TYPES = new Set([
  "Deck",
  "Fence",
  "Framing",
  "Concrete",
  "Roofing",
  "Other",
]);

const JOB_TYPE_GUIDANCE: Record<string, string> = {
  Deck:
    "This is a TIMBER DECK. Focus on: joists (size, spacing, span), bearers, posts (H5, footing depth), decking boards (size, length, spacing), stainless decking screws, joist hangers, post anchors, handrails/balustrade if shown, steps. Concrete bag counts for post footings.",
  Fence:
    "This is a FENCE. Focus on: posts (size, spacing, depth in ground, H5 treatment), top and bottom rails, pickets or panels, gates and gate hardware, concrete bag counts for post footings, fixings (galvanised nails/screws).",
  Framing:
    "This is TIMBER WALL/FLOOR/ROOF FRAMING. Focus on: top and bottom plates (90x45 H1.2 typical), studs and stud spacing (usually 600mm centres), noggins/dwangs (1 row per 1.35m of stud height), lintels over openings, trimmers, framing nails, framing brackets, GIB bracing.",
  Concrete:
    "This is CONCRETE WORK (slab/pad/footing). Focus on: plan dimensions, depth/thickness, reinforcing (D12 rebar, SE62/SE82 mesh), polythene DPM, formwork timber, bag counts (20kg bag covers ~0.01m³ — i.e. 100 bags per m³), or call it ready-mix m³ if a truck is implied.",
  Roofing:
    "This is ROOFING. Focus on: roof plan area, pitch, purlin size and spacing, long-run iron sheet lengths and overlaps, ridge, barge, flashings, building paper, roof screws (Tek screws), gutters and downpipes if shown.",
  Other:
    "General construction takeoff — be thorough with every dimension and labelled element.",
};

// The scan turns the drawing into the SAME shape of input the
// voice/type flow already produces: a plain-English, dimension-rich
// job description. Downstream, /api/quotes/generate parses it into
// line items (and the takeoff calculator can pick up framing / deck /
// cladding patterns automatically). That means scan-drawing piggybacks
// on all the existing material-matching, pricing, library, compliance
// and review tooling — no separate quote pipeline to maintain.
function buildSystemPrompt(jobType: string, timberLength: number): string {
  const guidance =
    JOB_TYPE_GUIDANCE[jobType] ?? JOB_TYPE_GUIDANCE.Other;
  return `You are an NZ-builder takeoff reader. The user uploaded a photo or scan of a hand-drawn construction plan/sketch.

TRADE CONTEXT (from the user, treat as authoritative):
- Job type: ${jobType}
- ${guidance}
- The tradie buys timber in ${timberLength}m lengths. When you note board / stud / plate / decking lengths, work in whole ${timberLength}m lengths and assume a 10% waste factor.

Your job: read every annotation on the drawing and produce a structured takeoff that a quoting AI can turn into materials and labour.

Read out, in order:
1. WHAT IS BEING BUILT — one short phrase. Use the trade context above.
2. PRIMARY DIMENSIONS — every length/width/height/depth on the drawing, in millimetres or metres exactly as written. If a dimension is in mm, restate it in metres too (e.g. "8820mm = 8.82m"). If there are step heights, riser/going, post heights, pile depths, fastener spacings — call them out. ONE DIMENSION PER LINE. Keep this section purely numeric so the tradie can review it quickly.
3. STRUCTURAL ELEMENTS — for each one, list the size, treatment, spacing and count, using the trade-context guidance above and the tradie's ${timberLength}m timber preference.
4. FIXINGS / FASTENERS / HARDWARE — joist hangers, post anchors, stainless decking screws, framing nails, coach screws, brackets.
5. CONCRETE / BAGS — count holes / pads / piles and note hole size if shown. Compute bag count where possible (20kg bag covers ~0.01m³).
6. ACCESSORIES — handrails, steps, balustrades, gates, infill, flashings.
7. EXPLICIT NOTES THE TRADIE WROTE — quote any text labels on the drawing word-for-word.
8. ASSUMPTIONS YOU MADE because the drawing was ambiguous. Flag with "Assumed:".
9. MISSING INFO the tradie should add (waste %, finish, ground conditions).

CRITICAL rules:
- DO NOT invent dimensions. If a number is not on the drawing, do not write one. Say "not shown".
- Use NZ trade vocabulary: GIB, H1.2 / H3.2 / H4 / H5 treated pine, 90x45, 140x45, 140x19 decking, Pink Batts, joist hangers, post anchors, stainless decking screws.
- Keep units explicit. mm or m, not "8.8" by itself.
- Be terse and structured, NOT chatty.
- Output STRICT JSON only — no prose, no markdown, no code fences.

Output shape:
{
  "buildType": string,
  "summary": string,
  "dimensions": string,
  "structural": string,
  "notes": string,
  "plan": {
    "shape": "rect" | "l_shape" | "line" | "other",
    "width_m": number,
    "length_m": number,
    "post_count": number | null,
    "post_spacing_m": number | null,
    "joist_spacing_mm": number | null,
    "joist_orientation": "width" | "length" | null,
    "height_m": number | null
  } | null
}

Where:
- "buildType" is a short noun phrase ("Timber deck", "1.8m boundary fence", "Garage GIB lining", …).
- "summary" is one sentence (under 200 chars) for log lines.
- "dimensions" is the PRIMARY DIMENSIONS section ONLY — one dimension per line, no headers, no extra commentary. This is what the tradie will review first to catch misreads. 4–20 lines typically.
- "structural" is sections 3–6 (structural elements, fixings, concrete, accessories) joined with newlines.
- "notes" is sections 7–9 (tradie's labels, assumptions, missing info) joined with newlines.
- "plan" is the smallest structured summary that a programmatic renderer can use to draw a clean schematic of what's being built. Use NULL for any field you can't extract from the drawing. Use NULL for the entire plan if the sketch is too ambiguous to produce a confident shape. Width and length in metres, joist spacing in millimetres. "line" shape is for fences (length_m only matters). "joist_orientation" is which axis the joists span across — "width" means joists run parallel to the width edge, "length" means parallel to the length edge.`;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

export interface ScannedPlan {
  shape: "rect" | "l_shape" | "line" | "other";
  width_m: number;
  length_m: number;
  post_count: number | null;
  post_spacing_m: number | null;
  joist_spacing_mm: number | null;
  joist_orientation: "width" | "length" | null;
  height_m: number | null;
}

interface ScanPayload {
  buildType?: string;
  summary?: string;
  dimensions?: string;
  structural?: string;
  notes?: string;
  plan?: ScannedPlan | null;
  // Tolerate the legacy single-transcript shape too.
  transcript?: string;
}

function sanitisePlan(raw: unknown): ScannedPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const shape =
    r.shape === "rect" || r.shape === "l_shape" || r.shape === "line"
      ? r.shape
      : "other";
  const w = Number(r.width_m);
  const l = Number(r.length_m);
  // Reject the plan outright if we don't have at least a width AND length —
  // the renderer can't draw anything sensible without them. Fences with
  // length only still need a length_m; we treat that as width_m=0 + length.
  if (!Number.isFinite(w) || !Number.isFinite(l)) return null;
  if (w <= 0 && l <= 0) return null;
  const optNum = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const orientation =
    r.joist_orientation === "width" || r.joist_orientation === "length"
      ? r.joist_orientation
      : null;
  return {
    shape,
    width_m: Math.max(0, w),
    length_m: Math.max(0, l),
    post_count: optNum(r.post_count),
    post_spacing_m: optNum(r.post_spacing_m),
    joist_spacing_mm: optNum(r.joist_spacing_mm),
    joist_orientation: orientation,
    height_m: optNum(r.height_m),
  };
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

  const jobTypeRaw = form.get("jobType");
  const jobType =
    typeof jobTypeRaw === "string" && JOB_TYPES.has(jobTypeRaw)
      ? jobTypeRaw
      : "Other";

  const timberLengthRaw = form.get("timberLength");
  let timberLength = 6;
  if (typeof timberLengthRaw === "string") {
    const parsed = Number.parseFloat(timberLengthRaw);
    if (Number.isFinite(parsed) && parsed >= 2.4 && parsed <= 7.2) {
      timberLength = Math.round(parsed * 10) / 10;
    }
  }

  const arrayBuf = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const mediaType = mime === "image/jpg" ? "image/jpeg" : mime;

  const userTextParts: string[] = [];
  userTextParts.push(
    `Job type: ${jobType}. Tradie buys timber in ${timberLength}m lengths and wants a 10% waste factor.`,
  );
  if (hint) {
    userTextParts.push(`Tradie note about this drawing: ${hint}`);
  }
  userTextParts.push(
    "Read every annotation on this hand-drawn plan and return the JSON described in the system prompt.",
  );

  const systemPrompt = buildSystemPrompt(jobType, timberLength);

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
        system: systemPrompt,
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

  const dimensions = (parsed.dimensions ?? "").trim();
  const structural = (parsed.structural ?? "").trim();
  const notes = (parsed.notes ?? "").trim();
  const legacyTranscript = (parsed.transcript ?? "").trim();

  if (!dimensions && !structural && !legacyTranscript) {
    return NextResponse.json(
      { error: "Couldn't read anything off that drawing. Try a clearer photo." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    buildType:
      typeof parsed.buildType === "string" ? parsed.buildType.trim() : "",
    summary:
      typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    dimensions: dimensions || legacyTranscript,
    structural,
    notes,
    plan: sanitisePlan(parsed.plan),
    jobType,
    timberLength,
  });
}
