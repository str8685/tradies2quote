// ─────────────────────────────────────────────────────────────────────────
// P1 REGRESSION PACK — weather assessment freshness / trust labels.
//
// Rules: an assessment older than the cron cadence (12h) is STALE and must
// be cued; unknown timestamps fail CLOSED (stale, "unknown"), never fresh.
// Deterministic — fixed ISO inputs, no clocks.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_STALE_AFTER_MS,
  isAssessmentStale,
  relativeAge,
} from "../freshness";

const NOW = "2026-06-10T12:00:00.000Z";
const agoISO = (ms: number) =>
  new Date(Date.parse(NOW) - ms).toISOString();

const H = 60 * 60 * 1000;
const M = 60 * 1000;

describe("isAssessmentStale — 12h cron-cadence threshold", () => {
  it("fresh inside the threshold", () => {
    expect(isAssessmentStale(agoISO(0), NOW)).toBe(false);
    expect(isAssessmentStale(agoISO(6 * H), NOW)).toBe(false);
    expect(isAssessmentStale(agoISO(12 * H - M), NOW)).toBe(false);
  });

  it("stale past the threshold", () => {
    expect(isAssessmentStale(agoISO(12 * H + M), NOW)).toBe(true);
    expect(isAssessmentStale(agoISO(48 * H), NOW)).toBe(true);
  });

  it("threshold constant is 12 hours", () => {
    expect(ASSESSMENT_STALE_AFTER_MS).toBe(12 * H);
  });

  it("fails CLOSED on missing/garbage timestamps (stale, never fresh)", () => {
    expect(isAssessmentStale(null, NOW)).toBe(true);
    expect(isAssessmentStale(undefined, NOW)).toBe(true);
    expect(isAssessmentStale("not-a-date", NOW)).toBe(true);
    expect(isAssessmentStale(agoISO(0), "garbage-now")).toBe(true);
  });
});

describe("relativeAge — compact trust-line ages", () => {
  it("buckets correctly", () => {
    expect(relativeAge(agoISO(30 * 1000), NOW)).toBe("just now");
    expect(relativeAge(agoISO(5 * M), NOW)).toBe("5m ago");
    expect(relativeAge(agoISO(59 * M), NOW)).toBe("59m ago");
    expect(relativeAge(agoISO(3 * H), NOW)).toBe("3h ago");
    expect(relativeAge(agoISO(23 * H), NOW)).toBe("23h ago");
    expect(relativeAge(agoISO(50 * H), NOW)).toBe("2d ago");
  });

  it("clock skew (generated in the future) clamps to 'just now'", () => {
    expect(relativeAge(agoISO(-5 * M), NOW)).toBe("just now");
  });

  it("unknown timestamps render 'unknown'", () => {
    expect(relativeAge(null, NOW)).toBe("unknown");
    expect(relativeAge("garbage", NOW)).toBe("unknown");
  });

  it("determinism: same inputs → same output", () => {
    expect(relativeAge(agoISO(3 * H), NOW)).toBe(relativeAge(agoISO(3 * H), NOW));
  });
});
