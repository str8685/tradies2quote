import { describe, it, expect } from "vitest";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import { orchestrate, type OrchestratorOutput } from "../orchestrator";

function makeQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    client: {
      name: "Sarah K",
      address: "12 Beach Rd",
      email: "sarah@example.com",
      phone: null,
    },
    job_summary: "Bathroom reno",
    line_items: [
      {
        type: "labour",
        description: "Tiling install · 2 days",
        quantity: 16,
        unit: "hr",
        unit_price: 75,
        line_total: 1200,
      },
    ],
    materials_subtotal: 0,
    labour_subtotal: 1200,
    markup_pct: 0,
    markup_amount: 0,
    subtotal_before_tax: 1200,
    tax_amount: 180,
    total: 1380,
    currency: "NZD",
    tax_label: "GST",
    tax_rate: 15,
    terms: "",
    notes: [],
    ...overrides,
  };
}

describe("orchestrate — output contract", () => {
  it("returns the seven required fields", () => {
    const out: OrchestratorOutput = orchestrate({
      status: "draft",
      quoteData: makeQuote(),
    });
    expect(out).toHaveProperty("stage");
    expect(out).toHaveProperty("stageLabel");
    expect(out).toHaveProperty("nextAction");
    expect(out).toHaveProperty("missing");
    expect(out).toHaveProperty("questions");
    expect(out).toHaveProperty("agentToTrigger");
    expect(out).toHaveProperty("approvalNeeded");
    expect(out).toHaveProperty("dashboardMessage");
  });
});

describe("orchestrate — draft", () => {
  it("proposes sendQuote for a complete draft", () => {
    const out = orchestrate({ status: "draft", quoteData: makeQuote() });
    expect(out.stage).toBe("draft");
    expect(out.nextAction?.action).toBe("sendQuote");
    expect(out.nextAction?.target).toBe("sent");
    expect(out.missing).toHaveLength(0);
    expect(out.approvalNeeded).toBe(true);
    expect(out.agentToTrigger).toBe("Compliance");
  });

  it("blocks send when client name is empty", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({
        client: { name: "", address: null, email: "a@b.com", phone: null },
      }),
    });
    expect(out.missing.some((m) => m.field === "client_name")).toBe(true);
    expect(out.nextAction).toBeNull();
    expect(out.approvalNeeded).toBe(false);
  });

  it("blocks send when client has no email AND no phone", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({
        client: { name: "Sarah K", address: null, email: null, phone: null },
      }),
    });
    expect(out.missing.some((m) => m.field === "client_contact")).toBe(true);
    expect(out.nextAction).toBeNull();
  });

  it("allows send when client has phone but no email", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({
        client: { name: "Sarah K", address: null, email: null, phone: "021000000" },
      }),
    });
    expect(out.missing.some((m) => m.field === "client_contact")).toBe(false);
    expect(out.nextAction?.action).toBe("sendQuote");
  });

  it("blocks send when line_items is empty", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({ line_items: [] }),
    });
    expect(out.missing.some((m) => m.field === "line_items")).toBe(true);
    expect(out.nextAction).toBeNull();
  });

  it("blocks send when total is 0", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({ total: 0 }),
    });
    expect(out.missing.some((m) => m.field === "total")).toBe(true);
  });

  it("offers Quote Review agent when there ARE missing fields", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({ line_items: [] }),
    });
    expect(out.agentToTrigger).toBe("Quote Review");
  });

  it("offers Compliance agent when the quote is clean", () => {
    const out = orchestrate({ status: "draft", quoteData: makeQuote() });
    expect(out.agentToTrigger).toBe("Compliance");
  });
});

describe("orchestrate — sent / viewed", () => {
  it("proposes acceptQuote for a sent quote", () => {
    const out = orchestrate({ status: "sent", quoteData: makeQuote() });
    expect(out.nextAction?.action).toBe("acceptQuote");
    expect(out.agentToTrigger).toBe("Follow-up");
  });

  it("proposes acceptQuote for a viewed quote", () => {
    const out = orchestrate({ status: "viewed", quoteData: makeQuote() });
    expect(out.nextAction?.action).toBe("acceptQuote");
    expect(out.agentToTrigger).toBe("Follow-up");
  });
});

describe("orchestrate — accepted onward", () => {
  it("proposes scheduleJob for an accepted quote", () => {
    const out = orchestrate({ status: "accepted", quoteData: makeQuote() });
    expect(out.nextAction?.action).toBe("scheduleJob");
    expect(out.nextAction?.target).toBe("scheduled");
  });

  it("proposes markInProgress for a scheduled quote", () => {
    const out = orchestrate({ status: "scheduled", quoteData: makeQuote() });
    expect(out.nextAction?.action).toBe("markInProgress");
  });

  it("proposes markComplete for an in_progress quote", () => {
    const out = orchestrate({ status: "in_progress", quoteData: makeQuote() });
    expect(out.nextAction?.action).toBe("markComplete");
  });
});

describe("orchestrate — terminal stages", () => {
  // Wave 14 — `completed` is no longer fully terminal for agents.
  // It still has no transition (nextAction null), but agentToTrigger
  // becomes "Invoice" when no invoice exists yet. Tested separately
  // below. Declined and expired remain fully terminal.
  const terminals: QuoteStatus[] = ["declined", "expired"];
  for (const s of terminals) {
    it(`returns no next action and no agent for ${s}`, () => {
      const out = orchestrate({ status: s, quoteData: makeQuote() });
      expect(out.nextAction).toBeNull();
      expect(out.approvalNeeded).toBe(false);
      expect(out.agentToTrigger).toBeNull();
    });
  }

  it("completed: no transition, but Invoice agent is suggested", () => {
    const out = orchestrate({ status: "completed", quoteData: makeQuote() });
    expect(out.nextAction).toBeNull();
    expect(out.approvalNeeded).toBe(false);
    expect(out.agentToTrigger).toBe("Invoice");
  });
});

describe("orchestrate — Wave 14 Voice Cleanup suggestion", () => {
  it("suggests Voice Cleanup on a clean draft when transcript exists", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote(),
      voiceTranscript: "Um, so I'm replacing a six metre wall, like, with gib.",
    });
    expect(out.agentToTrigger).toBe("Voice Cleanup");
  });

  it("transcript loses to missing-fields — Quote Review wins on dirty draft", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({ line_items: [] }),
      voiceTranscript: "Anything",
    });
    expect(out.agentToTrigger).toBe("Quote Review");
  });

  it("empty/whitespace transcript falls through to Compliance", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote(),
      voiceTranscript: "   ",
    });
    expect(out.agentToTrigger).toBe("Compliance");
  });

  it("no transcript at all falls through to Compliance on clean draft", () => {
    const out = orchestrate({ status: "draft", quoteData: makeQuote() });
    expect(out.agentToTrigger).toBe("Compliance");
  });
});

describe("orchestrate — Wave 14 Invoice suggestion", () => {
  it("suggests Invoice on completed quote without an existing invoice", () => {
    const out = orchestrate({
      status: "completed",
      quoteData: makeQuote(),
      invoiceExists: false,
    });
    expect(out.agentToTrigger).toBe("Invoice");
    expect(out.dashboardMessage).toMatch(/create a draft invoice/i);
  });

  it("does NOT re-suggest Invoice when an invoice already exists", () => {
    const out = orchestrate({
      status: "completed",
      quoteData: makeQuote(),
      invoiceExists: true,
    });
    expect(out.agentToTrigger).toBeNull();
    expect(out.dashboardMessage).toMatch(/invoice draft created/i);
  });

  it("does NOT suggest Invoice on other stages even when invoiceExists is falsy", () => {
    for (const s of ["draft", "sent", "viewed", "accepted", "scheduled", "in_progress"] as const) {
      const out = orchestrate({
        status: s,
        quoteData: makeQuote(),
        invoiceExists: false,
      });
      expect(out.agentToTrigger).not.toBe("Invoice");
    }
  });
});

describe("orchestrate — dashboardMessage", () => {
  it("includes the missing count in the draft message", () => {
    const out = orchestrate({
      status: "draft",
      quoteData: makeQuote({ line_items: [], total: 0 }),
    });
    expect(out.dashboardMessage).toMatch(/fix \d+ thing/);
  });

  it("reads as 'ready to send' for a clean draft", () => {
    const out = orchestrate({ status: "draft", quoteData: makeQuote() });
    expect(out.dashboardMessage.toLowerCase()).toContain("ready");
  });
});
