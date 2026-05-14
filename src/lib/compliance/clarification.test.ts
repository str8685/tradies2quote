import { describe, it, expect } from "vitest";
import { runClarificationRules } from "./clarification";
import type { JobContext } from "./types";

describe("runClarificationRules — non-wall jobs are passthrough", () => {
  it("'paint the front door' → no clarifications", () => {
    const ctx: JobContext = { description: "paint the front door, two coats" };
    const out = runClarificationRules(ctx);
    expect(out.clarifications).toEqual([]);
  });
});

describe("runClarificationRules — over-fire guard (wallJobNeedsClassification)", () => {
  it("'repaint the exterior weatherboards' → no clarifications (cosmetic, not construction)", () => {
    const ctx: JobContext = {
      description:
        "Repaint the exterior weatherboards, wash down, one coat primer then two top coats",
    };
    expect(runClarificationRules(ctx).clarifications).toEqual([]);
  });

  it("'build a timber retaining wall' → no clarifications (not a framed building wall)", () => {
    const ctx: JobContext = {
      description:
        "Build a timber retaining wall along the back boundary, H4 posts and rails",
    };
    expect(runClarificationRules(ctx).clarifications).toEqual([]);
  });

  it("'patch a crack in the wall' → no clarifications (no construction intent)", () => {
    const ctx: JobContext = {
      description: "Patch a crack in the hallway wall and sand it back",
    };
    expect(runClarificationRules(ctx).clarifications).toEqual([]);
  });

  it("'reline the bathroom wall' → still triggers clarifications (genuine lining work)", () => {
    const ctx: JobContext = {
      description: "Reline the bathroom wall with new sheets after the leak",
    };
    expect(runClarificationRules(ctx).clarifications.length).toBeGreaterThan(0);
  });
});

describe("runClarificationRules — bare 'build a wall' triggers all 9 questions (test 10)", () => {
  const bare: JobContext = { description: "build a 6m x 2.7m wall" };

  it("returns the 9 expected questions when nothing is known", () => {
    const out = runClarificationRules(bare);
    const ids = out.clarifications.map((c) => c.id).sort();
    expect(ids).toEqual(
      [
        "wall.type",
        "wall.isLoadbearing",
        "wall.isBracing",
        "wall.isWetArea",
        "wall.isThermalEnvelope",
        "wall.cladding",
        "wall.lining",
        "wall.treatmentClass",
        "wall.studSpacingMm",
        "wall.acousticOrFireRequired",
      ].sort(),
    );
  });

  it("each question has a non-empty `why` explaining the impact", () => {
    const out = runClarificationRules(bare);
    for (const q of out.clarifications) {
      expect(q.why.length).toBeGreaterThan(20);
    }
  });

  it("`wall.type` includes both internal and external as options", () => {
    const out = runClarificationRules(bare);
    const typeQ = out.clarifications.find((c) => c.id === "wall.type");
    expect(typeQ).toBeDefined();
    expect(typeQ?.options?.map((o) => o.value).sort()).toEqual([
      "external",
      "internal",
    ]);
  });
});

describe("runClarificationRules — partial answers shrink the question set", () => {
  it("internal wall + no other answers → no cladding question (cladding is for external)", () => {
    const ctx: JobContext = {
      description: "build a 6m x 2.7m wall",
      wall: { type: "internal" },
    };
    const out = runClarificationRules(ctx);
    expect(out.clarifications.find((c) => c.id === "wall.cladding")).toBeUndefined();
    expect(out.clarifications.find((c) => c.id === "wall.lining")).toBeDefined();
  });

  it("external wall + no other answers → no lining question (lining is for internal)", () => {
    const ctx: JobContext = {
      description: "build a 6m x 2.7m wall",
      wall: { type: "external" },
    };
    const out = runClarificationRules(ctx);
    expect(out.clarifications.find((c) => c.id === "wall.lining")).toBeUndefined();
    expect(out.clarifications.find((c) => c.id === "wall.cladding")).toBeDefined();
  });

  it("treatment class declared in description → no treatment-class question", () => {
    const ctx: JobContext = {
      description: "build a 6m x 2.7m H3.2 framed wall",
      wall: { type: "external" },
    };
    const out = runClarificationRules(ctx);
    expect(
      out.clarifications.find((c) => c.id === "wall.treatmentClass"),
    ).toBeUndefined();
  });
});
