import { describe, expect, it } from "vitest";
import { parseCustomerChat } from "../customer-chat";

describe("parseCustomerChat (tool-input normalisation)", () => {
  it("passes a valid chat result through", () => {
    const res = parseCustomerChat({
      intent: "explain_line_item",
      reply: "Line 3 is the GIB stopping.",
      noteToTradie: null,
      confidence: 0.8,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.intent).toBe("explain_line_item");
    expect(res.value.reply).toContain("GIB");
    expect(res.value.noteToTradie).toBeUndefined();
    expect(res.value.confidence).toBe(0.8);
  });

  it("captures a noteToTradie when present", () => {
    const res = parseCustomerChat({
      intent: "wants_scope_change",
      reply: "I'll flag that to Sam.",
      noteToTradie: "  Customer wants to add a second coat.  ",
      confidence: 0.7,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.noteToTradie).toBe("Customer wants to add a second coat.");
  });

  it("clamps unknown intent + out-of-range confidence; falls back on empty reply", () => {
    const res = parseCustomerChat({ intent: "nope", reply: "  ", confidence: 9 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.intent).toBe("general_question");
    expect(res.value.confidence).toBe(1); // clamped to [0,1]
    expect(res.value.reply).toMatch(/get back to you/i);
  });

  it("defaults confidence to 0.6 when missing", () => {
    const res = parseCustomerChat({ intent: "small_talk_or_thanks", reply: "Cheers!" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.confidence).toBe(0.6);
  });
});
