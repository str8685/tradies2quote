import { describe, expect, it } from "vitest";
import { assembleEvidence, type HistoryLine } from "./evidence";
import type { LibraryMaterial } from "../../quote-types";

function lib(o: Partial<LibraryMaterial> & { name: string }): LibraryMaterial {
  return {
    id: o.id ?? o.name.toLowerCase().replace(/\s+/g, "-"),
    name: o.name,
    unit: o.unit ?? "each",
    default_unit_price: o.default_unit_price ?? null,
    supplier: o.supplier ?? null,
    supplier_url: null,
    notes: null,
    usage_count: o.usage_count ?? 0,
    is_ai_estimated: o.is_ai_estimated ?? false,
    last_used_at: null,
  };
}

const target = (description: string, unit: string | null = "length") => ({
  description,
  quantity: 10,
  unit,
});

describe("assembleEvidence — strong library match (short-circuit signal)", () => {
  it("flags a priced, unit-compatible library match as strongLibraryMatch", () => {
    const e = assembleEvidence(target("140x45 H3.2 SG8 Pine", "length"), {
      library: [
        lib({ name: "140x45 H3.2 SG8 Pine", unit: "length", default_unit_price: 28.4 }),
        lib({ name: "90x45 H1.2 Pine", unit: "length", default_unit_price: 11.2 }),
      ],
    });
    expect(e.strongLibraryMatch).not.toBeNull();
    expect(e.strongLibraryMatch!.name).toBe("140x45 H3.2 SG8 Pine");
    expect(e.strongLibraryMatch!.unit_price).toBe(28.4);
  });

  it("does NOT mark a library match strong when it has no price", () => {
    const e = assembleEvidence(target("140x45 H3.2 SG8 Pine"), {
      library: [lib({ name: "140x45 H3.2 SG8 Pine", default_unit_price: null })],
    });
    expect(e.strongLibraryMatch).toBeNull();
    // …but it's still surfaced as a candidate for the AI to reason over.
    expect(e.candidates.some((c) => c.name === "140x45 H3.2 SG8 Pine")).toBe(true);
  });

  it("does NOT mark strong when the unit is incompatible", () => {
    const e = assembleEvidence(target("140x45 H3.2 SG8 Pine", "m"), {
      library: [lib({ name: "140x45 H3.2 SG8 Pine", unit: "length", default_unit_price: 28.4 })],
    });
    expect(e.strongLibraryMatch).toBeNull();
  });

  it("treats a null target unit as compatible", () => {
    const e = assembleEvidence(target("140x45 H3.2 SG8 Pine", null), {
      library: [lib({ name: "140x45 H3.2 SG8 Pine", unit: "length", default_unit_price: 28.4 })],
    });
    expect(e.strongLibraryMatch).not.toBeNull();
  });
});

describe("assembleEvidence — candidates + ranking", () => {
  it("returns candidates from history when the library has no match", () => {
    const history: HistoryLine[] = [
      { source: "corrected_history", name: "Stainless Decking Screws 10g 50mm", unit: "box", unit_price: 89 },
      { source: "supplier_import", name: "GIB Standard 13mm", unit: "sheet", unit_price: 24.4 },
    ];
    const e = assembleEvidence(target("decking screws stainless 10g", "box"), {
      library: [],
      history,
    });
    expect(e.strongLibraryMatch).toBeNull();
    expect(e.candidates[0].name).toMatch(/Decking Screws/i);
    expect(e.candidates[0].source).toBe("corrected_history");
  });

  it("ranks higher token overlap first and prefers priced over unpriced at a tie", () => {
    const e = assembleEvidence(target("90x45 H1.2 SG8 Pine framing"), {
      library: [
        lib({ name: "90x45 H1.2 SG8 Pine", default_unit_price: 11.2 }),
        lib({ name: "Pine framing nails", default_unit_price: 9 }),
      ],
    });
    expect(e.candidates[0].name).toBe("90x45 H1.2 SG8 Pine");
  });

  it("returns no candidates when nothing is relevant", () => {
    const e = assembleEvidence(target("kwila decking oil 4L", "each"), {
      library: [lib({ name: "Concrete bag 20kg", default_unit_price: 12 })],
    });
    expect(e.candidates).toEqual([]);
    expect(e.strongLibraryMatch).toBeNull();
  });
});
