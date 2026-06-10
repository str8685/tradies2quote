// ─────────────────────────────────────────────────────────────────────────
// P0 REGRESSION PACK — deck leakage.
//
// Hard rule: deck materials must be IMPOSSIBLE unless deck evidence is
// explicitly present (scan classified type=deck, or an explicit deck
// noun in the tradie's own words). Joist/bearer/decking-adjacent
// vocabulary in a non-deck job must never produce a deck line.
//
// Deterministic — no LLM. Runs in CI on every push.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { runTakeoff } from "../orchestrator";
import { licenseScopes, materialFamilyForDescription } from "../license";
import { routeScope } from "../scope-router";
import type { TakeoffResult } from "../schemas";

const DECK_LINE_RE =
  /\b(deck\s+joists?|deck\s+bearers?|decking\s+boards?|decking\s+screws?|joist\s+hangers?|concrete\s+piles?)\b/i;

function deckLines(result: TakeoffResult) {
  return result.scopes
    .filter((s) => s.scope === "deck")
    .flatMap((s) => s.lines)
    .concat(
      result.scopes
        .flatMap((s) => s.lines)
        .filter((l) => DECK_LINE_RE.test(l.name) || l.category === "Decking"),
    );
}

// Non-deck jobs that use deck-adjacent vocabulary. NONE may produce a
// deck line; each must record a deck license denial when deck routed.
const NON_DECK_JOBS: Array<{ name: string; text: string }> = [
  { name: "fence with joists wording", text: "Build a 12m fence, 1.8 high, fix the palings to 100x50 joists" },
  { name: "fence with bearers", text: "New boundary fence 15m long 1.8m high with bearers at the base" },
  { name: "pergola with bearers + joists", text: "Pergola over the patio, 4m x 3m, bearers and joists at 600 centres" },
  { name: "subfloor floor joists", text: "Renew the subfloor, replace the floor joists, area 6m x 4m" },
  { name: "carport with joist hangers", text: "Carport roof framing 6m x 3m using joist hangers on the beams" },
  { name: "verb phrase deck out", text: "Deck out the office with shelving and a partition wall 4m x 2.4m" },
  { name: "decked out", text: "The garage is getting decked out with storage, frame a wall 3m x 2.4m" },
  { name: "retaining wall with piles", text: "Retaining wall 8m long with concrete piles every 1.2m" },
  { name: "wall framing only", text: "Frame a partition wall 4m long 2.4m high with GIB both sides" },
  { name: "bathroom reno", text: "Bathroom renovation: reline walls 12m2, new skirting and architraves" },
  { name: "joist repair no deck", text: "Sister up two sagging joists under the hallway, supply H1.2 timber" },
  { name: "fence + bearer mention", text: "Replace fence rails and a rotten bearer, 10 metres of fencing" },
];

// Genuine deck jobs — deck must still calculate (license must not
// over-block real work).
const DECK_JOBS: Array<{ name: string; text: string }> = [
  { name: "explicit deck with dims", text: "Build a deck 6m x 4m, joists at 450 centres on piles" },
  { name: "decking re-lay", text: "Re-lay the decking on an existing 5m x 3m frame" },
  { name: "kwila deck boards", text: "New kwila deck 4.8m by 3.6m with 140x32 decking boards" },
];

describe("P0 regression — deck leakage (non-deck jobs produce ZERO deck lines)", () => {
  for (const job of NON_DECK_JOBS) {
    it(`${job.name}: no deck lines`, () => {
      const result = runTakeoff(job.text);
      const leaked = deckLines(result);
      expect(
        leaked.map((l) => l.name),
        `deck materials leaked into: "${job.text}"`,
      ).toEqual([]);
      // No deck scope may calculate at all.
      const deckScopes = result.scopes.filter(
        (s) => s.scope === "deck" && s.lines.length > 0,
      );
      expect(deckScopes).toEqual([]);
    });

    it(`${job.name}: deck is denied (when routed) and the denial is visible`, () => {
      const route = routeScope(job.text);
      const { licenses, denials } = licenseScopes(job.text, route);
      expect(licenses.find((l) => l.scope === "deck")).toBeUndefined();
      if (route.scopes.includes("deck")) {
        expect(denials.find((d) => d.scope === "deck")).toBeDefined();
        const result = runTakeoff(job.text);
        expect(
          result.license_denials?.some((d) => d.scope === "deck"),
        ).toBe(true);
        // Denial is surfaced, never silent.
        expect(result.warnings.some((w) => w.startsWith("deck:"))).toBe(true);
      }
    });
  }

  it("primary_scope is never a denied deck", () => {
    for (const job of NON_DECK_JOBS) {
      const result = runTakeoff(job.text);
      expect(result.primary_scope, job.name).not.toBe("deck");
    }
  });
});

describe("P0 regression — genuine deck jobs still calculate", () => {
  for (const job of DECK_JOBS) {
    it(`${job.name}: deck licensed and lines produced`, () => {
      const result = runTakeoff(job.text);
      expect(result.licenses?.some((l) => l.scope === "deck")).toBe(true);
      const deck = result.scopes.find((s) => s.scope === "deck");
      expect(deck).toBeDefined();
      expect(deck!.status).not.toBe("blocked");
      expect(deck!.lines.length).toBeGreaterThan(0);
    });
  }

  it("scan marker type=deck licenses deck even without prose deck nouns", () => {
    const route = routeScope("joists and bearers layout per plan");
    const { licenses } = licenseScopes(
      "joists and bearers layout per plan",
      route,
      { scanType: "deck" },
    );
    expect(licenses.some((l) => l.scope === "deck")).toBe(true);
    expect(
      licenses.find((l) => l.scope === "deck")?.granted_by.kind,
    ).toBe("scan_marker");
  });

  it("determinism: same input → identical output", () => {
    const a = runTakeoff(DECK_JOBS[0].text);
    const b = runTakeoff(DECK_JOBS[0].text);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("P0 regression — LLM-line family classifier (route filter input)", () => {
  it("classifies bare member terms as deck family (no 'deck' prefix needed)", () => {
    expect(materialFamilyForDescription("H3.2 90x45 joists")).toBe("deck");
    expect(materialFamilyForDescription("Bearers 2/140x45 H3.2")).toBe("deck");
    expect(materialFamilyForDescription("Joist hangers 90mm")).toBe("deck");
    expect(materialFamilyForDescription("Decking screws 10g")).toBe("deck");
    expect(materialFamilyForDescription("Concrete piles 125mm")).toBe("deck");
  });
  it("floor joists are FRAMING family (subfloors legitimately use them)", () => {
    expect(materialFamilyForDescription("Floor joists 140x45")).toBe("framing");
  });
  it("non-takeoff materials are unclassified (never dropped)", () => {
    expect(materialFamilyForDescription("Exterior paint 10L")).toBeNull();
    expect(materialFamilyForDescription("100x50 rails H3.2")).toBeNull();
    expect(materialFamilyForDescription("Sika construction adhesive")).toBeNull();
  });
});
