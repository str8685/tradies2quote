import { describe, it, expect } from "vitest";
import {
  isIOSUserAgent,
  isStandalone,
  type StandaloneWindow,
} from "./pwa-helpers";

describe("isIOSUserAgent", () => {
  it("detects iPhone Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(isIOSUserAgent(ua)).toBe(true);
  });

  it("detects iPad on older iOS (UA still has iPad)", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(isIOSUserAgent(ua)).toBe(true);
  });

  it("detects iPod", () => {
    const ua =
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(isIOSUserAgent(ua)).toBe(true);
  });

  it("does NOT detect Android", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36";
    expect(isIOSUserAgent(ua)).toBe(false);
  });

  it("does NOT detect desktop Mac Safari (no touch points)", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15";
    expect(isIOSUserAgent(ua, 0)).toBe(false);
  });

  it("does NOT detect desktop Mac Safari when maxTouchPoints is omitted", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15";
    expect(isIOSUserAgent(ua)).toBe(false);
  });

  it("does NOT detect desktop Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";
    expect(isIOSUserAgent(ua)).toBe(false);
  });

  it("detects iPadOS 13+ pretending to be Mac (Mac UA + multi-touch)", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15";
    expect(isIOSUserAgent(ua, 5)).toBe(true);
  });

  it("returns false for empty user agent", () => {
    expect(isIOSUserAgent("")).toBe(false);
  });
});

describe("isStandalone", () => {
  it("true when (display-mode: standalone) matches", () => {
    const win: StandaloneWindow = {
      matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" }),
    };
    expect(isStandalone(win)).toBe(true);
  });

  it("true when navigator.standalone is true (iOS Home Screen)", () => {
    const win: StandaloneWindow = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    };
    expect(isStandalone(win)).toBe(true);
  });

  it("false when neither signal is present (regular browser tab)", () => {
    const win: StandaloneWindow = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false },
    };
    expect(isStandalone(win)).toBe(false);
  });

  it("false when win is undefined (SSR / pre-mount)", () => {
    expect(isStandalone(undefined)).toBe(false);
  });

  it("false when matchMedia is missing (older browsers) and navigator.standalone is undefined", () => {
    const win: StandaloneWindow = {};
    expect(isStandalone(win)).toBe(false);
  });

  it("survives matchMedia throwing", () => {
    const win: StandaloneWindow = {
      matchMedia: () => {
        throw new Error("matchMedia kaboom");
      },
      navigator: { standalone: true },
    };
    // The throw must NOT crash detection — falls through to navigator.standalone.
    expect(isStandalone(win)).toBe(true);
  });
});
