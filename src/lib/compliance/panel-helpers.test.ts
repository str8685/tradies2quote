import { describe, it, expect } from "vitest";
import {
  answersAreComplete,
  answersToWallContext,
  categoriseWarning,
  emptyAnswers,
  groupWarningsByCategory,
  summariseReview,
} from "./panel-helpers";
import type {
  ClarificationQuestion,
  ComplianceReview,
  ComplianceWarning,
} from "./types";

const w = (
  title: string,
  severity: ComplianceWarning["severity"] = "warning",
): ComplianceWarning => ({
  severity,
  title,
  message: title,
  citations: [],
});

describe("categoriseWarning", () => {
  it("'Pink Batts not required' → insulation", () => {
    expect(categoriseWarning(w("Pink Batts not required by default"))).toBe(
      "insulation",
    );
  });

  it("'Insulation in an internal wall' → insulation", () => {
    expect(
      categoriseWarning(w("Insulation in an internal wall — not required by default")),
    ).toBe("insulation");
  });

  it("'Treatment class not specified' → treatment", () => {
    expect(
      categoriseWarning(w("Treatment class not specified for external timber")),
    ).toBe("treatment");
  });

  it("'Bright nails are unsafe' → fastener", () => {
    expect(categoriseWarning(w("Bright nails are unsafe for this exposure"))).toBe(
      "fastener",
    );
  });

  it("'Fastener finish unspecified' → fastener", () => {
    expect(categoriseWarning(w("Fastener finish unspecified"))).toBe("fastener");
  });

  it("unrecognised → other", () => {
    expect(categoriseWarning(w("Random other warning"))).toBe("other");
  });
});

describe("groupWarningsByCategory", () => {
  it("buckets warnings by category in a stable order", () => {
    const out = groupWarningsByCategory([
      w("Treatment class not specified for external timber"),
      w("Pink Batts not required by default"),
      w("Bright nails are unsafe", "blocker"),
      w("Random other thing"),
    ]);
    expect(out.treatment).toHaveLength(1);
    expect(out.insulation).toHaveLength(1);
    expect(out.fastener).toHaveLength(1);
    expect(out.other).toHaveLength(1);
    expect(out.clarification).toHaveLength(0);
  });
});

describe("summariseReview", () => {
  const baseReview: ComplianceReview = {
    status: "ok",
    items: [],
    clarifications: [],
    warnings: [],
    citations: [],
    diagnostics: { enabled: true, rulesRun: [] },
  };

  it("status=ok, no warnings → safe to send", () => {
    expect(summariseReview(baseReview).isSafeToSend).toBe(true);
  });

  it("status=disabled → also safe to send (engine off)", () => {
    expect(
      summariseReview({ ...baseReview, status: "disabled" }).isSafeToSend,
    ).toBe(true);
  });

  it("status=needs_clarification → NOT safe to send", () => {
    const summary = summariseReview({
      ...baseReview,
      status: "needs_clarification",
      clarifications: [
        { id: "wall.type", question: "?", why: "?" } as ClarificationQuestion,
      ],
    });
    expect(summary.isSafeToSend).toBe(false);
    expect(summary.clarificationsCount).toBe(1);
  });

  it("status=warnings_only with non-blocker warnings → not safe (status alone disqualifies)", () => {
    const summary = summariseReview({
      ...baseReview,
      status: "warnings_only",
      warnings: [w("foo", "warning")],
    });
    expect(summary.isSafeToSend).toBe(false);
    expect(summary.warningCounts.warning).toBe(1);
  });

  it("counts warnings by severity", () => {
    const summary = summariseReview({
      ...baseReview,
      warnings: [w("a", "info"), w("b", "warning"), w("c", "blocker"), w("d", "blocker")],
    });
    expect(summary.warningCounts).toEqual({ info: 1, warning: 1, blocker: 2 });
  });
});

describe("emptyAnswers", () => {
  it("returns an object with one empty key per question", () => {
    const qs: ClarificationQuestion[] = [
      { id: "wall.type", question: "?", why: "?" },
      { id: "wall.isLoadbearing", question: "?", why: "?" },
    ];
    expect(emptyAnswers(qs)).toEqual({
      "wall.type": "",
      "wall.isLoadbearing": "",
    });
  });
});

describe("answersToWallContext — parses the form back into a typed partial", () => {
  it("internal/external string → WallType", () => {
    expect(answersToWallContext({ "wall.type": "internal" }).type).toBe("internal");
    expect(answersToWallContext({ "wall.type": "external" }).type).toBe("external");
  });

  it("ignores invalid type values", () => {
    expect(answersToWallContext({ "wall.type": "garage" }).type).toBeUndefined();
  });

  it("yes/no booleans for the binary fields", () => {
    const c = answersToWallContext({
      "wall.isLoadbearing": "yes",
      "wall.isBracing": "no",
      "wall.isWetArea": "no",
      "wall.isThermalEnvelope": "yes",
      "wall.acousticOrFireRequired": "no",
    });
    expect(c).toEqual({
      isLoadbearing: true,
      isBracing: false,
      isWetArea: false,
      isThermalEnvelope: true,
      acousticOrFireRequired: false,
    });
  });

  it("numeric studSpacingMm parsed; non-numeric ignored", () => {
    expect(answersToWallContext({ "wall.studSpacingMm": "600" }).studSpacingMm).toBe(600);
    expect(
      answersToWallContext({ "wall.studSpacingMm": "huh" }).studSpacingMm,
    ).toBeUndefined();
    expect(
      answersToWallContext({ "wall.studSpacingMm": "-1" }).studSpacingMm,
    ).toBeUndefined();
  });

  it("validates cladding and lining against allowed values", () => {
    expect(
      answersToWallContext({ "wall.cladding": "weatherboard" }).cladding,
    ).toBe("weatherboard");
    expect(
      answersToWallContext({ "wall.cladding": "made up" }).cladding,
    ).toBeUndefined();
    expect(
      answersToWallContext({ "wall.lining": "gib_aqualine" }).lining,
    ).toBe("gib_aqualine");
    expect(
      answersToWallContext({ "wall.lining": "made up" }).lining,
    ).toBeUndefined();
  });

  it("empty input → empty partial", () => {
    expect(answersToWallContext({})).toEqual({});
  });
});

describe("answersAreComplete", () => {
  const qs: ClarificationQuestion[] = [
    { id: "wall.type", question: "?", why: "?" },
    { id: "wall.isLoadbearing", question: "?", why: "?" },
  ];

  it("true when every question has a non-empty answer", () => {
    expect(
      answersAreComplete(qs, {
        "wall.type": "internal",
        "wall.isLoadbearing": "yes",
      }),
    ).toBe(true);
  });

  it("false when any question is unanswered", () => {
    expect(answersAreComplete(qs, { "wall.type": "internal" })).toBe(false);
    expect(
      answersAreComplete(qs, { "wall.type": "internal", "wall.isLoadbearing": "" }),
    ).toBe(false);
  });
});
