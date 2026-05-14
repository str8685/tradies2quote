import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_PREFIX = "audio/";
const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
// gpt-4o-transcribe is OpenAI's current speech model — notably better
// than the legacy whisper-1 on accents and job-site noise. Same
// endpoint + params, so it's a drop-in. Kept as a constant so it's one
// line to A/B or revert once the eval set exists.
const TRANSCRIBE_MODEL = "gpt-4o-transcribe";
// Vocabulary bias passed as the model's `prompt`. The model leans
// toward hearing these NZ trade terms / brands instead of their common
// English soundalikes ("jib" -> GIB, "age three two" -> H3.2). This
// fixes mishears at the source; the quote prompt + transcript cleanup
// still catch anything that slips through.
const TRADE_VOCAB_PROMPT =
  "A New Zealand building tradesperson describing a job for a quote. " +
  "Expect NZ trade terms and brands: GIB and GIB-line plasterboard, " +
  "Pink Batts insulation, H1.2, H3.2, H4 and H5 treated timber, " +
  "90x45 and 140x45 framing pine, SG8, dwangs, nogs, studs, plates, " +
  "weatherboard, fascia, soffit, spouting, plywood bracing, macrocarpa, " +
  "rimu, and suppliers like Mitre 10, PlaceMakers, Bunnings and ITM.";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured. Set OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an 'audio' field." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'audio' file field." },
      { status: 400 },
    );
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Audio file is empty." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Audio file exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)} MB limit.` },
      { status: 413 },
    );
  }
  if (audio.type && !audio.type.startsWith(ACCEPTED_PREFIX)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${audio.type}` },
      { status: 415 },
    );
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "recording.webm");
  upstream.append("model", TRANSCRIBE_MODEL);
  upstream.append("response_format", "json");
  // Bias the model toward NZ trade vocabulary at transcription time.
  upstream.append("prompt", TRADE_VOCAB_PROMPT);
  // Default to English — every target country (NZ/AU/UK/US/CA) is
  // English-speaking, so this stops the model wasting effort (or
  // mis-guessing) on language detection. A caller can still override.
  const languageRaw = form.get("language");
  const language =
    typeof languageRaw === "string" && languageRaw.trim().length > 0
      ? languageRaw.trim()
      : "en";
  upstream.append("language", language);

  // One retry on a transient upstream error (5xx / 429) — re-recording
  // on a job site is painful, and these blips usually clear instantly.
  // A 4xx won't fix itself, so it's returned straight away.
  let transcribeRes: Response | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    transcribeRes = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
    if (transcribeRes.ok) break;
    if (
      attempt === 1 &&
      (transcribeRes.status >= 500 || transcribeRes.status === 429)
    ) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    break;
  }

  if (!transcribeRes || !transcribeRes.ok) {
    const detail = transcribeRes
      ? await transcribeRes.text().catch(() => "")
      : "no response";
    console.error("Transcription error", transcribeRes?.status, detail);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 },
    );
  }

  let payload: { text?: string };
  try {
    payload = (await transcribeRes.json()) as { text?: string };
  } catch {
    // 200 OK but a non-JSON body (proxy/CDN error page, truncated
    // stream). Treat it as an upstream failure, not a 500.
    console.error("Transcription returned a non-JSON 200 body");
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 },
    );
  }
  const transcript = (payload.text ?? "").trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "Could not detect any speech in the recording." },
      { status: 422 },
    );
  }

  return NextResponse.json({ transcript });
}
