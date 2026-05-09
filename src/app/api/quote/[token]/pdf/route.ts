import { type NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { downloadPdf } from "@/lib/quote-storage";
import { quoteNumber } from "@/lib/quote-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { token: string };

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { token } = await ctx.params;
  const admin = adminClient();
  const { data: quoteRaw, error } = await admin
    .from("quotes")
    .select("id, pdf_path, created_at, expires_at, status")
    .eq("public_token", token)
    .maybeSingle();
  const quote = quoteRaw as
    | {
        id: string;
        pdf_path: string | null;
        created_at: string;
        expires_at: string | null;
        status: string;
      }
    | null;
  if (error || !quote || !quote.pdf_path) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadPdf(quote.pdf_path);
  } catch (e) {
    console.error("Public PDF download failed", e);
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
