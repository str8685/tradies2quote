// Client-only image prep for the AI scan uploads.
//
// Two problems this solves before an image is POSTed:
//   1. iPhones shoot HEIC, which Claude's vision API can't read — convert
//      to JPEG (heic2any, dynamically imported so it only loads when a HEIC
//      is actually picked).
//   2. Vercel serverless functions reject request bodies over ~4.5 MB
//      (HTTP 413), and phone photos routinely exceed that — so we downscale
//      and re-encode. A 2000px JPEG is plenty for the model to read the
//      dimension labels, and lands well under the limit.
//
// All of this runs in the browser; the server still just receives a JPEG.

/** Re-encode/downscale anything larger than this; smaller files pass through. */
const PREP_OVER_BYTES = 3_500_000;
const MAX_DIM = 2000;
const JPEG_QUALITY = 0.8;

/** True if the file looks like an Apple HEIC/HEIF image. */
export function isHeic(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // iOS/Safari often reports an empty MIME type — fall back to the name.
  return /\.(heic|heif)$/i.test(file.name || "");
}

/** Whether the file needs converting and/or shrinking before upload. */
export function needsPrep(file: File): boolean {
  return isHeic(file) || file.size > PREP_OVER_BYTES;
}

async function heicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
  // heic2any returns a Blob, or Blob[] for multi-image HEICs — take the first.
  const blob = Array.isArray(out) ? out[0] : out;
  const name = (file.name || "photo").replace(/\.(heic|heif)$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

async function downscale(file: File): Promise<File> {
  if (file.size <= PREP_OVER_BYTES) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || MAX_DIM;
    const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || "photo").replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // fall back to the original; size checks still guard
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Prepare a user-picked image for a scan upload: convert HEIC → JPEG if
 * needed, then downscale/compress so it clears Vercel's ~4.5 MB body limit.
 * Throws only if a HEIC genuinely can't be decoded.
 */
export async function prepareScanImage(file: File): Promise<File> {
  const jpeg = isHeic(file) ? await heicToJpeg(file) : file;
  return downscale(jpeg);
}
