import { describe, expect, it } from "vitest";
import { parseQuote } from "../quote-generation";

describe("parseQuote (tool-input normalisation)", () => {
  it("normalises a valid quote: rounding, category clamp, defaults", () => {
    const res = parseQuote({
      jobName: "  Deck build  ",
      clientName: "  Dave  ",
      lineItems: [
        {
          description: "  H3.2 90x45  ",
          quantity: 12,
          unit: "lm",
          unitPrice: 6.005,
          lineTotal: 72.06,
          category: "materials",
        },
        {
          description: "Labour",
          quantity: 8,
          unit: "hr",
          unitPrice: 85,
          lineTotal: 680,
          category: "made-up", // invalid → clamps to "materials"
        },
      ],
      subtotal: 752.06,
      gstRate: 0.15,
      gstAmount: 112.81,
      total: 864.87,
      notes: ["10% waste on timber", 5],
      terms: "Net 7.",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const q = res.value;
    expect(q.jobName).toBe("Deck build");
    expect(q.clientName).toBe("Dave");
    expect(q.lineItems[0].description).toBe("H3.2 90x45");
    expect(q.lineItems[0].unitPrice).toBe(6.01); // round2
    expect(q.lineItems[1].category).toBe("materials"); // clamped
    expect(q.gstRate).toBe(0.15);
    // non-string notes are dropped
    expect(q.notes).toEqual(["10% waste on timber"]);
  });

  it("recomputes totals when the model omits them", () => {
    const res = parseQuote({
      jobName: "X",
      lineItems: [
        { description: "A", quantity: 2, unit: "each", unitPrice: 10, lineTotal: 20, category: "materials" },
        { description: "B", quantity: 1, unit: "each", unitPrice: 30, lineTotal: 30, category: "labour" },
      ],
      notes: [],
      terms: "",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.subtotal).toBe(50);
    expect(res.value.gstAmount).toBe(7.5);
    expect(res.value.total).toBe(57.5);
    expect(res.value.clientName).toBe("TBC"); // default when absent
  });

  it("drops empty-description lines and computes lineTotal from qty×price", () => {
    const res = parseQuote({
      lineItems: [
        { description: "", quantity: 5, unit: "each", unitPrice: 9, category: "materials" },
        { description: "Real", quantity: 3, unit: "each", unitPrice: 4, category: "materials" },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.lineItems).toHaveLength(1);
    expect(res.value.lineItems[0].lineTotal).toBe(12);
  });

  it("rejects (triggers retry) when there are no usable line items", () => {
    expect(parseQuote({ lineItems: [] }).ok).toBe(false);
    expect(parseQuote({}).ok).toBe(false);
    expect(parseQuote({ lineItems: [{ description: "" }] }).ok).toBe(false);
  });
});
