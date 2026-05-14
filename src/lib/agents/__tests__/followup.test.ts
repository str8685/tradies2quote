import { describe, it, expect } from "vitest";
import {
  runFollowupAgent,
  recommendedFollowupKind,
  type FollowupContext,
} from "../followup";
import type { QuoteStatus } from "@/lib/quote-types";

/** ISO string for `n` days (+1h, so `daysSince` floors cleanly) ago. */
function daysAgoIso(n: number): string {
  return new Date(Date.now() - (n * 86_400_000 + 3_600_000)).toISOString();
}

function ctx(over: Partial<FollowupContext>): FollowupContext {
  return {
    quoteNumber: "Q-0001",
    clientName: "Dave",
    total: 4200,
    currency: "NZD",
    status: "sent",
    sentAtIso: daysAgoIso(4),
    businessName: "STR8 Builders",
    ...over,
  };
}

describe("recommendedFollowupKind", () => {
  it("returns null for quotes that aren't live (draft / accepted / declined / ...)", () => {
    const dead: QuoteStatus[] = [
      "draft",
      "accepted",
      "declined",
      "expired",
      "scheduled",
      "in_progress",
      "completed",
    ];
    for (const status of dead) {
      expect(recommendedFollowupKind(status, 5)).toBeNull();
    }
  });

  it("returns null when the quote was sent less than a day ago", () => {
    expect(recommendedFollowupKind("sent", null)).toBeNull();
    expect(recommendedFollowupKind("sent", 0)).toBeNull();
  });

  it("steps through the cadence as the quote ages", () => {
    expect(recommendedFollowupKind("sent", 1)).toBe("friendly-reminder");
    expect(recommendedFollowupKind("sent", 2)).toBe("friendly-reminder");
    expect(recommendedFollowupKind("sent", 3)).toBe("price-clarification");
    expect(recommendedFollowupKind("sent", 6)).toBe("price-clarification");
    expect(recommendedFollowupKind("sent", 7)).toBe("acceptance-nudge");
    expect(recommendedFollowupKind("sent", 30)).toBe("acceptance-nudge");
  });

  it("treats a viewed quote as live too", () => {
    expect(recommendedFollowupKind("viewed", 4)).toBe("price-clarification");
  });
});

describe("runFollowupAgent — recommendation", () => {
  it("recommends nothing for a draft quote", () => {
    const msgs = runFollowupAgent(ctx({ status: "draft", sentAtIso: null }));
    expect(msgs.every((m) => !m.recommended)).toBe(true);
  });

  it("recommends exactly one message for a quote sent days ago", () => {
    const msgs = runFollowupAgent(ctx({ sentAtIso: daysAgoIso(4) }));
    const recommended = msgs.filter((m) => m.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe("price-clarification");
    expect(recommended[0].applies).toBe(true);
    expect(recommended[0].timingHint).toBeTruthy();
  });

  it("never recommends the missing-info template", () => {
    for (const days of [1, 3, 7, 20]) {
      const msgs = runFollowupAgent(ctx({ sentAtIso: daysAgoIso(days) }));
      const rec = msgs.find((m) => m.recommended);
      expect(rec?.id).not.toBe("missing-info");
    }
  });

  it("still returns all four templates regardless of recommendation", () => {
    const msgs = runFollowupAgent(ctx({ sentAtIso: daysAgoIso(10) }));
    expect(msgs).toHaveLength(4);
  });
});
