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
  const terminals: QuoteStatus[] = ["completed", "declined", "expired"];
  for (const s of terminals) {
    it(`returns no next action for ${s}`, () => {
      const out = orchestrate({ status: s, quoteData: makeQuote() });
      expect(out.nextAction).toBeNull();
      expect(out.approvalNeeded).toBe(false);
      expect(out.agentToTrigger).toBeNull();
    });
  }
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
