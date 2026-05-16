import { describe, expect, it } from "vitest";
import { normalizePhone } from "./quote-validation";

describe("normalizePhone", () => {
  it("returns empty string for empty input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });

  it("strips whitespace, dashes, parens, dots", () => {
    expect(normalizePhone("+64 22 504 4457")).toBe("+64225044457");
    expect(normalizePhone("(022) 504-4457")).toBe("+64225044457");
    expect(normalizePhone("022.504.4457")).toBe("+64225044457");
  });

  it("converts NZ national format to E.164", () => {
    expect(normalizePhone("0225044457")).toBe("+64225044457");
    expect(normalizePhone("027 555 1234")).toBe("+64275551234");
  });

  it("passes through correctly formatted E.164", () => {
    expect(normalizePhone("+6422504457")).toBe("+6422504457");
    expect(normalizePhone("+447700900123")).toBe("+447700900123");
    expect(normalizePhone("+15125551234")).toBe("+15125551234");
  });

  it("fixes the country-code-plus-leading-zero data-entry bug", () => {
    // The common NZ tradie data-entry mistake: typing +64 AND keeping
    // the leading 0. Twilio rejects this — the leading 0 is a national
    // prefix, not part of the subscriber number. Live bug caught in
    // production on 2026-05-17.
    expect(normalizePhone("+640225044457")).toBe("+64225044457");
    expect(normalizePhone("+64 022 504 4457")).toBe("+64225044457");
    expect(normalizePhone("+64-022-504-4457")).toBe("+64225044457");
  });

  it("leaves non-NZ international numbers untouched", () => {
    // +44 (UK) → 0 after the country code is NOT a leading-zero bug,
    // it's just an unlikely combination. We only special-case +64.
    expect(normalizePhone("+447700900123")).toBe("+447700900123");
  });
});
