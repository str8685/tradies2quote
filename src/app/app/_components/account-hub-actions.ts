"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Wave 14.7 — avatar photo server actions for the account hub.
 *
 * Two actions:
 *   - uploadAvatarAction(formData)  → upload + persist public URL
 *   - removeAvatarAction()          → delete file + null the column
 *
 * Storage layout (matches the Wave 14.7 migration):
 *   bucket: profile-avatars (public read)
 *   path:   {auth.uid()}/{Date.now()}.{ext}
 *
 * Defense-in-depth:
 *   - File type allow-list (jpg/jpeg/png/webp) AND server-side
 *     enforcement of the same list via mime check. The storage bucket
 *     itself ALSO enforces the same mime allow-list, so a bad upload
 *     is rejected twice — once by us, once by Postgres-side storage.
 *   - 2 MB size cap, server-checked + bucket-enforced.
 *   - Path always prefixed with the authenticated user's uid; the
 *     storage RLS policies ("Avatars: insert own" etc.) reject anything
 *     outside `{auth.uid()}/...`, so the user cannot write to anyone
 *     else's folder even if a future caller forgets to prefix.
 *
 * Failure mode: any error returns `{ ok: false, error: string }` and
 * leaves the existing avatar untouched. The client surfaces the error
 * and the initials fallback continues to render.
 */

const BUCKET = "profile-avatars";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME: ReadonlyArray<string> = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type AvatarActionResult =
  | { ok: true; avatarUrl: string | null }
  | { ok: false; error: string };

/** Pick a safe filename extension from the file's mime type. */
function extForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/**
 * Returns the storage object name (e.g. `abc.../1700000000000.jpg`)
 * encoded in a public URL. We persist the URL rather than the bare
 * path so `<img src>` works without any client-side compose step.
 */
async function uploadFileForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  file: File,
): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  if (file.size === 0) {
    return { ok: false, error: "Empty file." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "File is over 2 MB." };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return {
      ok: false,
      error: "Use a JPG, PNG, or WebP image.",
    };
  }
  const ext = extForMime(file.type);
  if (!ext) {
    return { ok: false, error: "Unsupported image format." };
  }

  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
  if (uploadErr) {
    return {
      ok: false,
      error: uploadErr.message || "Storage upload failed.",
    };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) {
    return { ok: false, error: "Could not build public URL." };
  }
  return { ok: true, url: pub.publicUrl, path };
}

/**
 * Server action — handle a multipart FormData with `avatar` file.
 * Returns the new URL (or an error). The caller revalidates the app
 * tree via the `revalidatePath` calls below so every header / sheet
 * picks up the new avatar without a hard refresh.
 */
export async function uploadAvatarAction(
  formData: FormData,
): Promise<AvatarActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const raw = formData.get("avatar");
  if (!(raw instanceof File)) {
    return { ok: false, error: "No file." };
  }

  // Capture the existing URL so we can clean it up after the new
  // upload + DB update succeed. We never block the upload on the
  // delete — orphaned files don't break anything, they just waste
  // a tiny bit of bucket space until the next upload tidies.
  const { data: prior } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const priorUrl =
    prior && typeof (prior as { avatar_url?: unknown }).avatar_url === "string"
      ? (prior as { avatar_url: string }).avatar_url
      : null;

  const up = await uploadFileForUser(supabase, user.id, raw as File);
  if (!up.ok) return up;

  // Persist URL on the user's profile row. RLS already gates writes
  // to profiles by id = auth.uid().
  const { error: dbErr } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, avatar_url: up.url },
      { onConflict: "id" },
    );
  if (dbErr) {
    // Best-effort cleanup of the new object so we don't leave an
    // orphan in storage on a DB failure.
    await supabase.storage.from(BUCKET).remove([up.path]).catch(() => {});
    return { ok: false, error: dbErr.message || "Could not save avatar." };
  }

  // Best-effort delete of the previous object. Ignore errors — the
  // new avatar is live regardless.
  if (priorUrl) {
    const priorPath = extractPathFromPublicUrl(priorUrl);
    if (priorPath) {
      await supabase.storage.from(BUCKET).remove([priorPath]).catch(() => {});
    }
  }

  // Repaint every surface that shows the avatar.
  revalidatePath("/app", "layout");
  return { ok: true, avatarUrl: up.url };
}

/**
 * Server action — drop the user's avatar (storage file + profile column).
 */
export async function removeAvatarAction(): Promise<AvatarActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: prior } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const priorUrl =
    prior && typeof (prior as { avatar_url?: unknown }).avatar_url === "string"
      ? (prior as { avatar_url: string }).avatar_url
      : null;

  // Null the column first so the UI flips to initials immediately on
  // refresh, regardless of storage cleanup.
  const { error: dbErr } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, avatar_url: null },
      { onConflict: "id" },
    );
  if (dbErr) {
    return { ok: false, error: dbErr.message || "Could not clear avatar." };
  }

  if (priorUrl) {
    const path = extractPathFromPublicUrl(priorUrl);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    }
  }

  revalidatePath("/app", "layout");
  return { ok: true, avatarUrl: null };
}

/**
 * Given a Supabase public URL like
 *   https://xxx.supabase.co/storage/v1/object/public/profile-avatars/{uid}/{ts}.jpg
 * return the object path inside the bucket (`{uid}/{ts}.jpg`).
 *
 * Returns null if the URL doesn't look like one of ours — we never
 * want to accidentally delete an object from a different bucket.
 */
function extractPathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}
