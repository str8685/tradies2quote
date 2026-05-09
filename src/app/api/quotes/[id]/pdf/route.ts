import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadPdf } from "@/lib/quote-storage";
import { quoteNumber } from "@/lib/quote-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, pdf_path, created_at")
    .eq("id", id)
    .single();
  if (!quote || !quote.pdf_path) {
    return NextResponse.json({ error: "no_pdf" }, { status: 404 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadPdf(quote.pdf_path);
  } catch (e) {
    console.error("PDF download failed", e);
    return NextResponse.json({ error: "download_failed" }, { status: 500 });
  }

  const filename = `${quoteNumber(quote.id, quote.created_at)}.pdf`;
  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
