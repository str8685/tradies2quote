import "server-only";
import { adminClient } from "./supabase/admin";

const PDF_BUCKET = "quote-pdfs";
const SIGNATURE_BUCKET = "signatures";

export function pdfPath(userId: string, quoteId: string): string {
  return `${userId}/${quoteId}.pdf`;
}

export function signaturePath(quoteId: string): string {
  return `${quoteId}/signature.png`;
}

export async function uploadPdf(
  userId: string,
  quoteId: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = pdfPath(userId, quoteId);
  const supabase = adminClient();
  const { error } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }
  return path;
}

export async function uploadSignature(
  quoteId: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = signaturePath(quoteId);
  const supabase = adminClient();
  const { error } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    throw new Error(`Failed to upload signature: ${error.message}`);
  }
  return path;
}

export async function downloadPdf(path: string): Promise<Uint8Array> {
  const supabase = adminClient();
  const { data, error } = await supabase.storage.from(PDF_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Failed to download PDF: ${error?.message ?? "no data"}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function downloadSignature(path: string): Promise<Uint8Array> {
  const supabase = adminClient();
  const { data, error } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(
      `Failed to download signature: ${error?.message ?? "no data"}`,
    );
  }
  return new Uint8Array(await data.arrayBuffer());
}
