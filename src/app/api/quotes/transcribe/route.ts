import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_PREFIX = "audio/";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

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
  upstream.append("model", "whisper-1");
  upstream.append("response_format", "json");
  const language = form.get("language");
  if (typeof language === "string" && language.trim().length > 0) {
    upstream.append("language", language.trim());
  }

  const whisperRes = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });

  if (!whisperRes.ok) {
    const detail = await whisperRes.text().catch(() => "");
    console.error("Whisper error", whisperRes.status, detail);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 },
    );
  }

  const payload = (await whisperRes.json()) as { text?: string };
  const transcript = (payload.text ?? "").trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "Could not detect any speech in the recording." },
      { status: 422 },
    );
  }

  return NextResponse.json({ transcript });
}
