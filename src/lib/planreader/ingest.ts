// ─────────────────────────────────────────────────────────────────────────
// Plan-reader — server-side ingestion data-access (Phase 1).
//
// Creates the plan_files + plan_sheets rows for an upload and hands back
// signed Storage upload URLs so the browser can PUT the original file + each
// rendered page image DIRECTLY to the private bucket. Keeping the bytes off
// the serverless function avoids Vercel's ~4.5 MB request limit on multi-page
// plans, and the bucket's own RLS ({uid}/ prefix) still scopes every object.
//
// File ids are generated app-side (crypto.randomUUID) so we can compute the
// storage paths up front in one insert, with no extra round-trip.
// ─────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { PLAN_BUCKET, originalPath, pagePath } from "./storage";

type DB = SupabaseClient<Database>;

export type IngestMeta = {
  original_filename: string;
  mime: string;
  byte_size: number;
  page_count: number;
  quote_id?: string | null;
  project_id?: string | null;
};

export type SignedTarget = { path: string; token: string };

export type IngestResult = {
  file_id: string;
  original: SignedTarget;
  sheets: Array<{
    id: string;
    sheet_number: number;
    image_path: string;
    upload: SignedTarget;
  }>;
};

export type IngestOutcome =
  | { ok: true; value: IngestResult }
  | { ok: false; error: string };

/**
 * Insert the file + sheet rows and mint signed upload URLs. RLS guarantees
 * the rows belong to `userId` (the insert WITH CHECK forbids anything else).
 */
export async function createPlanRecords(
  supabase: DB,
  userId: string,
  meta: IngestMeta,
): Promise<IngestOutcome> {
  const fileId = crypto.randomUUID();
  const storage_path = originalPath(userId, fileId, meta.mime);

  const { error: fileErr } = await supabase.from("plan_files").insert({
    id: fileId,
    user_id: userId,
    quote_id: meta.quote_id ?? null,
    project_id: meta.project_id ?? null,
    original_filename: meta.original_filename,
    mime: meta.mime,
    byte_size: meta.byte_size,
    page_count: meta.page_count,
    storage_path,
    status: "uploaded",
  });
  if (fileErr) return { ok: false, error: `plan_files insert failed: ${fileErr.message}` };

  const sheetRows = Array.from({ length: meta.page_count }, (_, i) => {
    const sheet_number = i + 1;
    return {
      id: crypto.randomUUID(),
      file_id: fileId,
      user_id: userId,
      sheet_number,
      image_path: pagePath(userId, fileId, sheet_number),
      // sheet_type defaults to 'unknown', status to 'classified' — the
      // classify step fills real values. We do NOT pre-guess a type.
    };
  });

  const { error: sheetErr } = await supabase.from("plan_sheets").insert(sheetRows);
  if (sheetErr) {
    // Best-effort rollback so we don't leave an orphan file row.
    await supabase.from("plan_files").delete().eq("id", fileId);
    return { ok: false, error: `plan_sheets insert failed: ${sheetErr.message}` };
  }

  const storage = supabase.storage.from(PLAN_BUCKET);

  const originalSigned = await storage.createSignedUploadUrl(storage_path);
  if (originalSigned.error || !originalSigned.data) {
    return { ok: false, error: `could not sign original upload: ${originalSigned.error?.message}` };
  }

  const sheets: IngestResult["sheets"] = [];
  for (const s of sheetRows) {
    const signed = await storage.createSignedUploadUrl(s.image_path);
    if (signed.error || !signed.data) {
      return { ok: false, error: `could not sign page ${s.sheet_number} upload: ${signed.error?.message}` };
    }
    sheets.push({
      id: s.id,
      sheet_number: s.sheet_number,
      image_path: s.image_path,
      upload: { path: signed.data.path, token: signed.data.token },
    });
  }

  return {
    ok: true,
    value: {
      file_id: fileId,
      original: { path: originalSigned.data.path, token: originalSigned.data.token },
      sheets,
    },
  };
}
