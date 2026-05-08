import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NZ_DEFAULTS, round2 } from "@/lib/quote-defaults";
import { buildQuotePrompt } from "@/lib/quote-prompt";
import { matchToLibrary } from "@/lib/materials";
import type { LibraryMaterial, QuoteData, QuoteProfile } from "@/lib/quote-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Quote generation is not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Missing 'id' field" }, { status: 400 });
  }

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, voice_transcript, quote_data")
    .eq("id", id)
    .single();
  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  const transcript = (quote.voice_transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "Quote has no transcript" }, { status: 400 });
  }
  if (quote.quote_data) {
    return NextResponse.json(
      { error: "Quote has already been generated" },
      { status: 409 },
    );
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "business_name, country, default_labour_rate, default_markup_pct, tax_label, tax_rate, currency",
    )
    .eq("id", user.id)
    .maybeSingle();

  const profile: QuoteProfile = profileRow
    ? {
        business_name: profileRow.business_name,
        country: profileRow.country ?? NZ_DEFAULTS.country,
        default_labour_rate: Number(
          profileRow.default_labour_rate ?? NZ_DEFAULTS.default_labour_rate,
        ),
        default_markup_pct: Number(
          profileRow.default_markup_pct ?? NZ_DEFAULTS.default_markup_pct,
        ),
        tax_label: profileRow.tax_label ?? NZ_DEFAULTS.tax_label,
        tax_rate: Number(profileRow.tax_rate ?? NZ_DEFAULTS.tax_rate),
        currency: profileRow.currency ?? NZ_DEFAULTS.currency,
      }
    : NZ_DEFAULTS;

  const { data: libraryRows } = await supabase
    .from("materials")
    .select(
      "id, name, unit, default_unit_price, supplier, supplier_url, notes, usage_count, is_ai_estimated, last_used_at",
    )
    .eq("user_id", user.id)
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true });

  const library: LibraryMaterial[] = (libraryRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    default_unit_price:
      r.default_unit_price !== null ? Number(r.default_unit_price) : null,
    supplier: r.supplier,
    supplier_url: r.supplier_url,
    notes: r.notes,
    usage_count: Number(r.usage_count) || 0,
    is_ai_estimated: !!r.is_ai_estimated,
    last_used_at: r.last_used_at,
  }));

  const systemPrompt = buildQuotePrompt(profile, library);

  const claudeRes = await fetch(ANTHROPIC_URL, {
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
          content: `Job description from voice memo or typed input:\n\n${transcript}`,
        },
        {
          role: "assistant",
          content: "{",
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const detail = await claudeRes.text().catch(() => "");
    console.error("Claude API error", claudeRes.status, detail);
    return NextResponse.json(
      { error: "Quote generation failed. Please try again." },
      { status: 502 },
    );
  }

  const claudePayload = (await claudeRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  const text = claudePayload.content?.find((c) => c.type === "text")?.text ?? "";
  if (!text) {
    return NextResponse.json(
      { error: "Empty response from quote model. Please try again." },
      { status: 502 },
    );
  }
  const fullJson = "{" + text;

  let parsed: QuoteData;
  try {
    parsed = JSON.parse(fullJson) as QuoteData;
  } catch (e) {
    console.error(
      "Failed to parse Claude JSON",
      e,
      "stop_reason:",
      claudePayload.stop_reason,
      "raw (first 800):",
      fullJson.slice(0, 800),
    );
    return NextResponse.json(
      { error: "Quote response was malformed. Please try again." },
      { status: 502 },
    );
  }

  parsed.currency = profile.currency;
  parsed.tax_label = profile.tax_label;
  parsed.tax_rate = profile.tax_rate;
  parsed.markup_pct = profile.default_markup_pct;
  parsed.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
  parsed.line_items = Array.isArray(parsed.line_items) ? parsed.line_items : [];
  parsed.client = parsed.client ?? {
    name: "To be confirmed",
    address: null,
    contact: null,
  };
  parsed.terms = typeof parsed.terms === "string" ? parsed.terms : "";

  const usedLibraryIds = new Set<string>();
  let materials_subtotal = 0;
  let labour_subtotal = 0;
  for (const it of parsed.line_items) {
    const qty = Number(it.quantity) || 0;
    let price = Number(it.unit_price) || 0;
    if (it.type === "material") {
      const match = matchToLibrary(it.description, library);
      if (match) {
        it.library_id = match.id;
        it.is_ai_estimated = false;
        if (match.default_unit_price !== null) {
          price = Number(match.default_unit_price);
        }
        usedLibraryIds.add(match.id);
      } else {
        it.library_id = null;
        it.is_ai_estimated = true;
      }
    } else {
      it.library_id = null;
      it.is_ai_estimated = false;
    }
    const lt = round2(qty * price);
    it.quantity = qty;
    it.unit_price = price;
    it.line_total = lt;
    if (it.type === "labour") labour_subtotal += lt;
    else materials_subtotal += lt;
  }
  const markup_amount = round2(materials_subtotal * (profile.default_markup_pct / 100));
  const subtotal_before_tax = round2(materials_subtotal + markup_amount + labour_subtotal);
  const tax_amount = round2(subtotal_before_tax * (profile.tax_rate / 100));
  const total = round2(subtotal_before_tax + tax_amount);
  parsed.materials_subtotal = round2(materials_subtotal);
  parsed.labour_subtotal = round2(labour_subtotal);
  parsed.markup_amount = markup_amount;
  parsed.subtotal_before_tax = subtotal_before_tax;
  parsed.tax_amount = tax_amount;
  parsed.total = total;

  if (parsed.line_items.length > 0) {
    const { error: iErr } = await supabase.from("quote_items").insert(
      parsed.line_items.map((it) => ({
        quote_id: quote.id,
        type: it.type,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
    );
    if (iErr) {
      console.error("quote_items insert failed", iErr);
      return NextResponse.json(
        { error: "Failed to save line items" },
        { status: 500 },
      );
    }
  }

  const { error: uErr } = await supabase
    .from("quotes")
    .update({
      quote_data: parsed,
      total_amount: parsed.total,
      currency: parsed.currency,
    })
    .eq("id", quote.id);
  if (uErr) {
    console.error("quotes update failed", uErr);
    return NextResponse.json(
      { error: "Failed to save quote" },
      { status: 500 },
    );
  }

  if (usedLibraryIds.size > 0) {
    const ids = Array.from(usedLibraryIds);
    const now = new Date().toISOString();
    for (const matId of ids) {
      const current = library.find((m) => m.id === matId);
      const nextCount = (current?.usage_count ?? 0) + 1;
      await supabase
        .from("materials")
        .update({ usage_count: nextCount, last_used_at: now })
        .eq("id", matId);
    }
  }

  return NextResponse.json({ ok: true });
}
