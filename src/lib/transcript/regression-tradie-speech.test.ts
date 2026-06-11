// ─────────────────────────────────────────────────────────────────────────
// TRADIE-SPEECH REGRESSION PACK — transcript quality end to end.
//
// Real-shaped spoken utterances run through the DETERMINISTIC cleanup
// (measurements + H-classes + context-guarded brands + glossary; no LLM)
// and the assertions check what actually matters downstream:
//   - quote-critical numbers/dimensions survive AND become parseable,
//   - domain terms come out canonical,
//   - addresses/names/filler are never mangled,
//   - scope routing / licensing / wall-kind detection behave correctly on
//     the CLEANED text,
//   - and the no-hallucination invariants hold (digits in == digits out,
//     no silent deletions — every change is in the corrections audit).
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { applyDeterministicCorrections } from "../transcriptCleanup";
import { GLOBAL_GLOSSARY } from "./glossary";
import { detectWallKind, extractFromText } from "../takeoff/extraction";
import { licenseScopes } from "../takeoff/license";
import { routeScope } from "../takeoff/scope-router";

// Mirror the production routes: regex pass + the global glossary.
const VOCAB = { entries: GLOBAL_GLOSSARY };
const clean = (s: string) =>
  applyDeterministicCorrections(s, VOCAB).cleanedTranscript;

describe("tradie speech — dimensions become parseable downstream", () => {
  it("spoken wall job: numbers digitize and extraction finds spacing + height", () => {
    const raw =
      "um yeah so frame up a wall ten metres long and two point four high, " +
      "ninety by forty five at six hundred mil centres, gib both sides of the wall";
    const cleaned = clean(raw);
    expect(cleaned).toContain("10 metres");
    expect(cleaned).toContain("2.4 high");
    expect(cleaned).toContain("90x45");
    expect(cleaned).toContain("600mm centres");
    expect(cleaned).toContain("GIB"); // plasterboard context present

    // BEFORE/AFTER: the raw words fail extraction; the cleaned text parses.
    const extRaw = extractFromText(raw, "framing");
    const extClean = extractFromText(cleaned, "framing");
    expect(extRaw.spacing_mm).toBeNull();
    expect(extClean.spacing_mm).toBe(600);
    expect(extRaw.dimensions.height_m).toBeNull();
    expect(extClean.dimensions.height_m).toBe(2.4);
  });

  it("spoken deck job: dimensions digitize and the deck stays licensed", () => {
    const raw = "new kwila deck six by four metres, joists at four fifty centres";
    const cleaned = clean(raw);
    expect(cleaned).toContain("6x4 metres");
    const route = routeScope(cleaned);
    const { licenses } = licenseScopes(cleaned, route);
    expect(licenses.some((l) => l.scope === "deck")).toBe(true);
    const ext = extractFromText(cleaned, "deck");
    expect(ext.dimensions.length_m).toBe(6);
    expect(ext.dimensions.width_m).toBe(4);
  });

  it("insulation wording: exterior statement survives cleanup intact", () => {
    const raw = "insulate the exterior walls, twenty four square metres of wall";
    const cleaned = clean(raw);
    expect(cleaned).toContain("24 square metres");
    expect(detectWallKind(cleaned)).toBe("exterior");
    const ext = extractFromText(cleaned, "insulation");
    expect(ext.dimensions.area_m2).toBe(24);
  });

  it("H-classes + profile speech normalize together", () => {
    const cleaned = clean("h32 treated timber ninety by forty five for the bearers");
    expect(cleaned).toContain("H3.2");
    expect(cleaned).toContain("90x45");
    expect(cleaned).toContain("bearers");
  });
});

describe("tradie speech — what must NEVER change", () => {
  it("addresses, names and dates pass through untouched", () => {
    const raw =
      "job for Sam Smith at 12 Example Street, Gate Pa, Tauranga, starting on the 15th";
    expect(clean(raw)).toBe(raw);
  });

  it("prose numbers without measurement context stay words", () => {
    const raw = "one of the owners wants two quotes for the job";
    expect(clean(raw)).toBe(raw);
  });

  it("money slang is not converted to millimetres", () => {
    const raw = "the whole build budget is about 1.5 mil all up";
    expect(clean(raw)).toContain("1.5 mil");
  });

  it("filler speech is preserved (readability is the LLM summary's job, not a rewrite)", () => {
    const raw = "um yeah so basically we need to reclad the back wall";
    const out = applyDeterministicCorrections(raw);
    expect(out.cleanedTranscript).toBe(raw);
    expect(out.corrections).toEqual([]);
  });

  it("digit-preservation invariant across a messy line-item ramble", () => {
    const raw =
      "right so it's 14 sheets of GIB, 6 lengths of 90x45 H3.2, " +
      "2 packs of R2.2 batts, and allow 450 for fixings at 12 Example St";
    const out = clean(raw);
    for (const run of raw.match(/\d+(?:\.\d+)?/g) ?? []) {
      expect(out).toContain(run);
    }
  });

  it("every change is in the corrections audit (no silent rewrites)", () => {
    const raw = "frame ten metres with ninety by forty five h32";
    const { cleanedTranscript, corrections } = applyDeterministicCorrections(raw);
    expect(cleanedTranscript).not.toBe(raw);
    expect(corrections.length).toBeGreaterThanOrEqual(3);
    for (const c of corrections) {
      expect(c.before).toBeTruthy();
      expect(c.after).toBeTruthy();
    }
  });

  it("scan marker lines are never mangled by cleanup", () => {
    const raw =
      "[T2Q_PLAN] type=wall wall_run_m=40 exterior_wall_run_m=20 height_m=2.4\n" +
      "frame ten metres of wall";
    const cleaned = clean(raw);
    expect(cleaned.split("\n")[0]).toBe(
      "[T2Q_PLAN] type=wall wall_run_m=40 exterior_wall_run_m=20 height_m=2.4",
    );
  });
});

describe("tradie speech — deck vs house wording stays correctly scoped", () => {
  it('"deck out the office" still does NOT license deck after cleanup', () => {
    const cleaned = clean("deck out the office with shelving, wall four by two point four");
    const route = routeScope(cleaned);
    const { licenses } = licenseScopes(cleaned, route);
    expect(licenses.some((l) => l.scope === "deck")).toBe(false);
  });

  it("fence with joist wording stays deck-denied after cleanup", () => {
    const cleaned = clean("twelve metres of fence, fix palings to hundred by fifty rails");
    const route = routeScope(cleaned);
    const { licenses, denials } = licenseScopes(cleaned, route);
    expect(licenses.some((l) => l.scope === "deck")).toBe(false);
    expect(licenses.some((l) => l.scope === "fencing")).toBe(true);
    void denials;
  });

  it("determinism: same utterance twice → identical cleaned output", () => {
    const raw = "frame ten metres, ninety by forty five at six hundred mil centres";
    expect(clean(raw)).toBe(clean(raw));
  });
});
