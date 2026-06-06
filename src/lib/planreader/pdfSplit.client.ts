"use client";

// ─────────────────────────────────────────────────────────────────────────
// Plan-reader — client-side PDF → page-image splitter (Phase 1).
//
// The browser already holds the uploaded file, so we rasterize each PDF page
// to a PNG here (in the user's tab, via pdfjs-dist) and upload the page
// images. This mirrors the existing client-side HEIC→JPEG prep in ScanPanel
// and keeps any canvas/native dependency OFF the Vercel serverless runtime.
//
// Single images (PNG/JPG/WebP) bypass this and are treated as a 1-page plan.
// ─────────────────────────────────────────────────────────────────────────

export type RenderedPage = {
  pageNumber: number; // 1-based
  blob: Blob; // image/png
  width: number;
  height: number;
};

export type SplitOptions = {
  /** Target longest-edge pixels per page (clamped). Higher = sharper OCR. */
  maxEdgePx?: number;
  /** Hard cap on pages to render. */
  maxPages?: number;
  /** Progress callback (rendered, total). */
  onProgress?: (rendered: number, total: number) => void;
};

const DEFAULT_MAX_EDGE = 2200;
const DEFAULT_MAX_PAGES = 60;

let workerConfigured = false;

async function loadPdfjs() {
  // Dynamic import so this never lands in a server bundle.
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Bundler-resolved worker URL (Turbopack/webpack understand this form).
    const workerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    );
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();
    workerConfigured = true;
  }
  return pdfjs;
}

/**
 * Render every page of a PDF to a PNG blob. Throws if the file is not a
 * readable PDF — the caller should surface that as an upload error, not a
 * silent empty result.
 */
export async function splitPdfToPages(
  file: File | ArrayBuffer,
  opts: SplitOptions = {},
): Promise<RenderedPage[]> {
  const maxEdge = Math.min(4000, Math.max(800, opts.maxEdgePx ?? DEFAULT_MAX_EDGE));
  const maxPages = Math.min(200, Math.max(1, opts.maxPages ?? DEFAULT_MAX_PAGES));

  const pdfjs = await loadPdfjs();
  const data =
    file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const total = Math.min(doc.numPages, maxPages);
  const pages: RenderedPage[] = [];

  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const baseViewport = page.getViewport({ scale: 1 });
    const longest = Math.max(baseViewport.width, baseViewport.height);
    const scale = Math.min(4, maxEdge / longest);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error(`Failed to render page ${n}`);

    pages.push({
      pageNumber: n,
      blob,
      width: canvas.width,
      height: canvas.height,
    });
    page.cleanup();
    opts.onProgress?.(n, total);
  }

  await doc.destroy();
  return pages;
}

/**
 * Normalize ANY supported upload into page blobs. PDFs are split; single
 * images become a 1-page array unchanged.
 */
export async function toPageImages(
  file: File,
  opts: SplitOptions = {},
): Promise<RenderedPage[]> {
  if (file.type === "application/pdf") {
    return splitPdfToPages(file, opts);
  }
  return [{ pageNumber: 1, blob: file, width: 0, height: 0 }];
}
