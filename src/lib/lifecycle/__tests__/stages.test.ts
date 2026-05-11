import { describe, it, expect } from "vitest";
import type { QuoteStatus } from "@/lib/quote-types";
import {
  canTransition,
  isTerminal,
  nextStage,
  OWNER_TRANSITIONS,
  requiredFieldsFor,
  STAGE_LABELS,
  STAGES,
  stageLabel,
} from "../stages";

const ALL_STATUSES: readonly QuoteStatus[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "declined",
  "expired",
];

describe("STAGES + STAGE_LABELS exhaustiveness", () => {
  it("STAGES covers every QuoteStatus value", () => {
    for (const s of ALL_STATUSES) {
      expect(STAGES.includes(s)).toBe(true);
    }
    expect(STAGES.length).toBe(ALL_STATUSES.length);
  });

  it("STAGE_LABELS has a human label for every status", () => {
    for (const s of ALL_STATUSES) {
      expect(typeof STAGE_LABELS[s]).toBe("string");
      expect(STAGE_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});

describe("OWNER_TRANSITIONS — forward path", () => {
  it("draft -> sent", () =>
    expect(canTransition("draft", "sent")).toBe(true));
  it("draft -> declined", () =>
    expect(canTransition("draft", "declined")).toBe(true));
  it("sent -> accepted", () =>
    expect(canTransition("sent", "accepted")).toBe(true));
  it("sent -> declined", () =>
    expect(canTransition("sent", "declined")).toBe(true));
  it("viewed -> accepted", () =>
    expect(canTransition("viewed", "accepted")).toBe(true));
  it("accepted -> scheduled", () =>
    expect(canTransition("accepted", "scheduled")).toBe(true));
  it("scheduled -> in_progress", () =>
    expect(canTransition("scheduled", "in_progress")).toBe(true));
  it("in_progress -> completed", () =>
    expect(canTransition("in_progress", "completed")).toBe(true));
});

describe("OWNER_TRANSITIONS — forbidden moves", () => {
  it("no reverse transitions (sent -> draft)", () =>
    expect(canTransition("sent", "draft")).toBe(false));
  it("no skip-ahead (draft -> accepted)", () =>
    expect(canTransition("draft", "accepted")).toBe(false));
  it("no skip-ahead (accepted -> in_progress)", () =>
    expect(canTransition("accepted", "in_progress")).toBe(false));
  it("no skip-ahead (scheduled -> completed)", () =>
    expect(canTransition("scheduled", "completed")).toBe(false));

  it("terminal: declined cannot move anywhere", () => {
    for (const t of ALL_STATUSES) {
      expect(canTransition("declined", t)).toBe(false);
    }
  });
  it("terminal: expired cannot move anywhere", () => {
    for (const t of ALL_STATUSES) {
      expect(canTransition("expired", t)).toBe(false);
    }
  });
  it("terminal: completed cannot move anywhere", () => {
    for (const t of ALL_STATUSES) {
      expect(canTransition("completed", t)).toBe(false);
    }
  });
});

describe("nextStage", () => {
  const expected: Record<QuoteStatus, QuoteStatus | null> = {
    draft: "sent",
    sent: "accepted",
    viewed: "accepted",
    accepted: "scheduled",
    scheduled: "in_progress",
    in_progress: "completed",
    completed: null,
    declined: null,
    expired: null,
  };
  for (const s of ALL_STATUSES) {
    it(`nextStage(${s}) === ${expected[s]}`, () => {
      expect(nextStage(s)).toBe(expected[s]);
    });
  }
});

describe("isTerminal", () => {
  it("terminal statuses report true", () => {
    expect(isTerminal("declined")).toBe(true);
    expect(isTerminal("expired")).toBe(true);
    expect(isTerminal("completed")).toBe(true);
  });
  it("non-terminal statuses report false", () => {
    expect(isTerminal("draft")).toBe(false);
    expect(isTerminal("sent")).toBe(false);
    expect(isTerminal("viewed")).toBe(false);
    expect(isTerminal("accepted")).toBe(false);
    expect(isTerminal("scheduled")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });
});

describe("requiredFieldsFor", () => {
  it("only `sent` has prerequisites in Wave 13", () => {
    expect(requiredFieldsFor("sent")).toEqual([
      "client_name",
      "line_items",
      "total",
    ]);
  });
  it("every other stage has no required-fields list", () => {
    for (const s of ALL_STATUSES) {
      if (s === "sent") continue;
      expect(requiredFieldsFor(s)).toEqual([]);
    }
  });
});

describe("stageLabel", () => {
  it("returns the human label", () => {
    expect(stageLabel("in_progress")).toBe("In progress");
    expect(stageLabel("scheduled")).toBe("Scheduled");
    expect(stageLabel("declined")).toBe("Declined");
  });
});

describe("OWNER_TRANSITIONS does NOT expose `viewed` as an owner target", () => {
  // `viewed` is set automatically by the public-quote route when a
  // customer opens the share link. The owner never picks it.
  it("no row in OWNER_TRANSITIONS lists `viewed` as a target", () => {
    for (const s of ALL_STATUSES) {
      expect(OWNER_TRANSITIONS[s].includes("viewed")).toBe(false);
    }
  });
});
