import { describe, expect, it } from "vitest";
import {
  MAX_SCAN_SOURCE_BYTES,
  detectImageMime,
  isPreparedScanMime,
  isSupportedScanInput,
  normaliseImageMime,
  scanUploadSizeError,
  sniffPreparedImageMime,
} from "./imageUpload";

function fileLike(input: { name?: string; type?: string; size?: number }) {
  return {
    name: input.name ?? "",
    size: input.size ?? 1024,
    type: input.type ?? "",
  } as File;
}

describe("image upload helpers", () => {
  it("normalises Android image/jpg to image/jpeg", () => {
    expect(normaliseImageMime("image/jpg")).toBe("image/jpeg");
  });

  it("falls back to the filename when Safari provides an empty MIME type", () => {
    expect(detectImageMime(fileLike({ name: "quote-photo.JPG", type: "" }))).toBe(
      "image/jpeg",
    );
    expect(detectImageMime(fileLike({ name: "site-plan.heic", type: "" }))).toBe(
      "image/heic",
    );
  });

  it("falls back to the filename for generic mobile upload MIME types", () => {
    expect(
      detectImageMime(
        fileLike({ name: "site-plan.HEIC", type: "application/octet-stream" }),
      ),
    ).toBe("image/heic");
  });

  it("accepts prepared vision image types and HEIC source images", () => {
    expect(isPreparedScanMime("image/png")).toBe(true);
    expect(isSupportedScanInput(fileLike({ name: "deck.webp", type: "" }))).toBe(
      true,
    );
    expect(isSupportedScanInput(fileLike({ name: "iphone.HEIC", type: "" }))).toBe(
      true,
    );
  });

  it("rejects unsupported source files", () => {
    expect(
      isSupportedScanInput(
        fileLike({ name: "quote.pdf", type: "application/pdf" }),
      ),
    ).toBe(false);
  });

  it("reports empty files and oversized source images before browser prep", () => {
    expect(scanUploadSizeError(fileLike({ size: 0 }))).toBe("That file is empty.");
    expect(
      scanUploadSizeError(fileLike({ size: MAX_SCAN_SOURCE_BYTES + 1 })),
    ).toMatch(/Max 30 MB/);
  });

  it("sniffs common prepared image bytes", () => {
    expect(sniffPreparedImageMime(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffPreparedImageMime(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      sniffPreparedImageMime(
        Uint8Array.from([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45,
          0x42, 0x50,
        ]),
      ),
    ).toBe("image/webp");
    expect(
      sniffPreparedImageMime(
        Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
      ),
    ).toBe("image/gif");
  });

  it("does not treat non-image bytes as supported", () => {
    expect(sniffPreparedImageMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46]))).toBe(
      null,
    );
  });
});
