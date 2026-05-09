import { describe, it, expect } from "vitest";
import { normalizeMaterialQuery } from "./materialNormalizer";

describe("normalizeMaterialQuery — treatment class preservation", () => {
  it("preserves H1.2 (internal framing)", () => {
    const r = normalizeMaterialQuery("H1.2 90x45 internal framing");
    expect(r.treatmentClass).toBe("H1.2");
    expect(r.size).toBe("90x45");
    expect(r.categoryHint).toBe("timber");
  });

  it("preserves H3.2 (deck joists / exposed timber)", () => {
    const r = normalizeMaterialQuery("H3.2 deck joist 240x45 5.4m");
    expect(r.treatmentClass).toBe("H3.2");
    expect(r.size).toBe("240x45");
    expect(r.categoryHint).toBe("timber");
  });

  it("preserves H4 (in-ground posts)", () => {
    const r = normalizeMaterialQuery("H4 post 100x100 2.4m");
    expect(r.treatmentClass).toBe("H4");
    expect(r.size).toBe("100x100");
    expect(r.categoryHint).toBe("timber");
  });

  it("preserves H5 (piles)", () => {
    const r = normalizeMaterialQuery("H5 pile 200x200 3m");
    expect(r.treatmentClass).toBe("H5");
    expect(r.size).toBe("200x200");
    expect(r.categoryHint).toBe("timber");
  });

  it("does NOT collapse H4 to H3.2 or H1.2 to H3.2", () => {
    expect(normalizeMaterialQuery("H4 post").treatmentClass).toBe("H4");
    expect(normalizeMaterialQuery("H3.2 joist").treatmentClass).toBe("H3.2");
    expect(normalizeMaterialQuery("H1.2 stud").treatmentClass).toBe("H1.2");
    // Each input must produce its OWN class, never another.
    expect(normalizeMaterialQuery("H4 post").treatmentClass).not.toBe("H3.2");
    expect(normalizeMaterialQuery("H3.2 joist").treatmentClass).not.toBe("H4");
    expect(normalizeMaterialQuery("H1.2 stud").treatmentClass).not.toBe("H3.2");
  });
});

describe("normalizeMaterialQuery — size normalisation", () => {
  it('"90 by 45" → "90x45"', () => {
    const r = normalizeMaterialQuery("90 by 45");
    expect(r.size).toBe("90x45");
    expect(r.normalized).toContain("90x45");
  });

  it('"90x45" stays "90x45"', () => {
    expect(normalizeMaterialQuery("90x45").size).toBe("90x45");
  });

  it('"100×100" → "100x100"', () => {
    expect(normalizeMaterialQuery("100×100").size).toBe("100x100");
  });

  it("does not collapse 90x45 and 90x90", () => {
    expect(normalizeMaterialQuery("90x45 stud").size).toBe("90x45");
    expect(normalizeMaterialQuery("90x90 plate").size).toBe("90x90");
  });
});

describe("normalizeMaterialQuery — sheet thickness", () => {
  it('"13mm GIB Aqualine" reads thicknessMm = 13', () => {
    const r = normalizeMaterialQuery("13mm GIB Aqualine 2400x1200");
    expect(r.thicknessMm).toBe(13);
    expect(r.brand).toBe("GIB");
    expect(r.tradeName).toBe("Aqualine");
    expect(r.categoryHint).toBe("plasterboard");
  });

  it('"10mm GIB Standard" reads thicknessMm = 10', () => {
    const r = normalizeMaterialQuery("10mm GIB Standard");
    expect(r.thicknessMm).toBe(10);
    expect(r.tradeName).toBe("Standard");
  });

  it("preserves the distinction between 10mm and 13mm GIB", () => {
    const ten = normalizeMaterialQuery("10mm GIB");
    const thirteen = normalizeMaterialQuery("13mm GIB");
    expect(ten.thicknessMm).toBe(10);
    expect(thirteen.thicknessMm).toBe(13);
    expect(ten.thicknessMm).not.toBe(thirteen.thicknessMm);
  });
});

describe("normalizeMaterialQuery — brand and trade name", () => {
  it("GIB Aqualine 13mm preserves brand AND trade name", () => {
    const r = normalizeMaterialQuery("GIB Aqualine 13mm 2400x1200");
    expect(r.brand).toBe("GIB");
    expect(r.tradeName).toBe("Aqualine");
  });

  it('"gib aqua" shorthand still resolves to Aqualine', () => {
    const r = normalizeMaterialQuery("gib aqua 13mm");
    expect(r.tradeName).toBe("Aqualine");
  });

  it("GIB Standard ≠ GIB Aqualine", () => {
    const std = normalizeMaterialQuery("GIB Standard 10mm");
    const aqua = normalizeMaterialQuery("GIB Aqualine 13mm");
    expect(std.tradeName).toBe("Standard");
    expect(aqua.tradeName).toBe("Aqualine");
    expect(std.tradeName).not.toBe(aqua.tradeName);
  });
});

describe("normalizeMaterialQuery — battens vs Pink Batts (critical)", () => {
  it('"Pink Batts R3.2" is insulation', () => {
    const r = normalizeMaterialQuery("Pink Batts R3.2");
    expect(r.brand).toBe("Pink Batts");
    expect(r.categoryHint).toBe("insulation");
  });

  it('"45x45 batten H3.2" is timber, not insulation', () => {
    const r = normalizeMaterialQuery("45x45 batten H3.2");
    expect(r.brand).toBeNull();
    expect(r.categoryHint).toBe("timber");
  });

  it('"pink bats" (typo) maps to Pink Batts insulation', () => {
    const r = normalizeMaterialQuery("pink bats R2.6");
    expect(r.brand).toBe("Pink Batts");
    expect(r.categoryHint).toBe("insulation");
  });

  it("battens stays in timber even when 'batt' substring is present", () => {
    const battens = normalizeMaterialQuery("H3.2 50x50 battens");
    expect(battens.categoryHint).toBe("timber");
    expect(battens.brand).toBeNull();
  });
});

describe("normalizeMaterialQuery — finish preservation", () => {
  it("stainless screws stay stainless", () => {
    const r = normalizeMaterialQuery("stainless screws 75mm");
    expect(r.finish).toBe("stainless");
    expect(r.categoryHint).toBe("fixing");
  });

  it("galvanised nails stay galvanised", () => {
    const r = normalizeMaterialQuery("galvanised nails 75mm");
    expect(r.finish).toBe("galvanised");
  });

  it('does NOT confuse "stainless" with "zinc"', () => {
    expect(normalizeMaterialQuery("stainless screw").finish).toBe("stainless");
    expect(normalizeMaterialQuery("zinc nail").finish).toBe("zinc");
  });
});

describe("normalizeMaterialQuery — category hints", () => {
  it("post / stud / joist / rafter → timber", () => {
    expect(normalizeMaterialQuery("90x45 stud").categoryHint).toBe("timber");
    expect(normalizeMaterialQuery("190x45 joist").categoryHint).toBe("timber");
    expect(normalizeMaterialQuery("100x50 rafter").categoryHint).toBe("timber");
  });

  it("Novaflow → drainage", () => {
    expect(normalizeMaterialQuery("110mm novaflow 20m").categoryHint).toBe(
      "drainage",
    );
  });

  it("Colorsteel → roofing", () => {
    expect(normalizeMaterialQuery("Colorsteel longrun").categoryHint).toBe(
      "roofing",
    );
  });
});

describe("normalizeMaterialQuery — spoken treatment numbers (Stage 4.3)", () => {
  it('"h four post" → treatmentClass H4', () => {
    const r = normalizeMaterialQuery("h four post 100x100");
    expect(r.treatmentClass).toBe("H4");
    expect(r.size).toBe("100x100");
    expect(r.categoryHint).toBe("timber");
  });

  it('"h five pile" → treatmentClass H5', () => {
    const r = normalizeMaterialQuery("h five pile 200x200");
    expect(r.treatmentClass).toBe("H5");
  });

  it('"h three joist" → treatmentClass H3', () => {
    const r = normalizeMaterialQuery("h three joist");
    expect(r.treatmentClass).toBe("H3");
  });

  it("does not trigger on unrelated 'four'/'five'", () => {
    expect(normalizeMaterialQuery("four sheets of GIB").treatmentClass).toBeNull();
    expect(normalizeMaterialQuery("five posts").treatmentClass).toBeNull();
  });

  it("preserves H3.2 written numerically (not affected by spoken expansion)", () => {
    expect(normalizeMaterialQuery("H3.2 deck joist").treatmentClass).toBe("H3.2");
  });
});

describe("normalizeMaterialQuery — edge cases", () => {
  it("empty string returns null fields and unknown category", () => {
    const r = normalizeMaterialQuery("");
    expect(r.treatmentClass).toBeNull();
    expect(r.size).toBeNull();
    expect(r.thicknessMm).toBeNull();
    expect(r.brand).toBeNull();
    expect(r.categoryHint).toBe("unknown");
  });

  it("whitespace is collapsed but tokens preserved", () => {
    const r = normalizeMaterialQuery("  H4   post   100x100  ");
    expect(r.treatmentClass).toBe("H4");
    expect(r.size).toBe("100x100");
    expect(r.normalized).toBe("h4 post 100x100");
  });
});
