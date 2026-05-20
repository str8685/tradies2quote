import { describe, expect, it } from "vitest";
import { runTakeoff, runTakeoffWithExtraction } from "../../orchestrator";
import { evaluatorStatusRank } from "../../schemas";
import { GOLDEN_CASES } from "./cases";

describe("golden takeoff regression suite", () => {
  for (const c of GOLDEN_CASES) {
    it(c.name, () => {
      const result =
        c.kind === "text"
          ? runTakeoff(c.description)
          : runTakeoffWithExtraction(c.extraction);
      const e = c.expect;

      if (e.overallStatus) expect(result.status).toBe(e.overallStatus);
      if (e.primaryScope) expect(result.primary_scope).toBe(e.primaryScope);

      if (e.evaluatorStatus) {
        expect(result.evaluator?.status).toBe(e.evaluatorStatus);
      }
      if (e.evaluatorAtMost) {
        const actual = result.evaluator?.status ?? "pass";
        expect(evaluatorStatusRank(actual)).toBeLessThanOrEqual(
          evaluatorStatusRank(e.evaluatorAtMost),
        );
      }

      for (const want of e.scopes ?? []) {
        const got = result.scopes.find((s) => s.scope === want.scope);
        expect(got, `expected scope "${want.scope}" to be present`).toBeTruthy();
        if (!got) continue;
        if (want.status) expect(got.status).toBe(want.status);
        if (want.minLines !== undefined) {
          expect(got.lines.length).toBeGreaterThanOrEqual(want.minLines);
        }
        if (want.primaryValueRange) {
          const [lo, hi] = want.primaryValueRange;
          expect(got.summary.primary_value).toBeGreaterThanOrEqual(lo);
          expect(got.summary.primary_value).toBeLessThanOrEqual(hi);
        }
        for (const id of want.requireLineIds ?? []) {
          expect(
            got.lines.find((l) => l.id === id),
            `expected line id "${id}" in scope "${want.scope}"`,
          ).toBeTruthy();
        }
      }

      for (const sc of e.blockedScopes ?? []) {
        const got = result.scopes.find((s) => s.scope === sc);
        expect(got?.status, `scope "${sc}" should be blocked`).toBe("blocked");
        expect(got?.clarifications.length ?? 0).toBeGreaterThan(0);
      }
    });
  }
});
