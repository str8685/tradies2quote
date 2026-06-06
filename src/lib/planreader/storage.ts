// ─────────────────────────────────────────────────────────────────────────
// Plan-reader — Supabase Storage bucket + path helpers (pure).
//
// Originals and per-page render images live in a private bucket, scoped to
// the owning user by path prefix ({user_id}/...). RLS on the bucket policy
// (Phase-1 migration) restricts objects to their owner. Access is via
// short-lived signed URLs only — never public.
// ─────────────────────────────────────────────────────────────────────────

/** Private Storage bucket for uploaded plans + rendered page images. */
export const PLAN_BUCKET = "plan-uploads";

/** Max bytes for a single uploaded original (PDF or image). */
export const MAX_PLAN_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Max pages we'll split + ingest from one PDF. */
export const MAX_PLAN_PAGES = 60;

function extForMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

/** Storage path for the uploaded original file. */
export function originalPath(
  userId: string,
  fileId: string,
  mime: string,
): string {
  return `${userId}/${fileId}/original.${extForMime(mime)}`;
}

/** Storage path for a rendered page image (1-based page number, PNG). */
export function pagePath(
  userId: string,
  fileId: string,
  pageNumber: number,
): string {
  return `${userId}/${fileId}/p${pageNumber}.png`;
}

/**
 * The path prefix that belongs to one user — used by the Storage RLS policy
 * and by any "list my plan objects" call. Kept here so the policy and the
 * code can't drift.
 */
export function userPrefix(userId: string): string {
  return `${userId}/`;
}
