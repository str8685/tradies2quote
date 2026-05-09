import { describe, it, expect, vi } from "vitest";
import {
  parseCsv,
  parseProductAttributes,
  csvRowToMaterial,
  csvToMaterials,
  deterministicId,
  materialsToInsertSql,
  assertNotProduction,
  applyImport,
  type CsvRow,
} from "./import-material-reference-library";

const sample = (over: Partial<CsvRow> = {}): CsvRow => ({
  Category: "TIMBER & WOOD",
  Product: "H1.2 Framing Timber 90x45mm",
  Unit: "per metre",
  Est_Price: "$3.50",
  Notes: "FSC certified",
  ...over,
});

describe("parseCsv", () => {
  it("parses a header + rows correctly", () => {
    const text =
      `Category,Product,Unit,Est_Price,Notes\n` +
      `TIMBER & WOOD,H1.2 Framing Timber 90x45mm,per metre,$3.50,FSC certified\n` +
      `INSULATION,Pink Batts R2.6 Ceiling 1160x430x140mm,per bale,$58.00,18.4m²`;
    const rows = parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].Category).toBe("TIMBER & WOOD");
    expect(rows[0].Product).toBe("H1.2 Framing Timber 90x45mm");
    expect(rows[1].Notes).toBe("18.4m²");
  });

  it("ignores blank lines and CRLF endings", () => {
    const text =
      `Category,Product,Unit,Est_Price,Notes\r\n\r\nTIMBER & WOOD,X,each,$1,n\r\n`;
    const rows = parseCsv(text);
    expect(rows).toHaveLength(1);
  });
});

describe("parseProductAttributes — treatment class", () => {
  it("preserves H1.2", () => {
    expect(parseProductAttributes("H1.2 Framing Timber 90x45mm", "per metre", "")
      .treatment_class).toBe("H1.2");
  });
  it("preserves H3 (NOT auto-promoted to H3.2)", () => {
    expect(parseProductAttributes("Fence Paling H3 100x19mm", "per 1.8m", "H3 treated")
      .treatment_class).toBe("H3");
  });
  it("preserves H3.2", () => {
    expect(parseProductAttributes("H3.2 Decking 90x32mm", "per metre", "").treatment_class).toBe("H3.2");
  });
  it("preserves H4", () => {
    expect(parseProductAttributes("H4 Pine Post 100x100mm", "per metre", "").treatment_class).toBe("H4");
  });
  it("preserves H5", () => {
    expect(parseProductAttributes("H5 Pile 200x200mm", "per metre", "").treatment_class).toBe("H5");
  });
  it("does NOT collapse H4 → H3.2 etc.", () => {
    expect(parseProductAttributes("H4 post", "", "").treatment_class).not.toBe("H3.2");
    expect(parseProductAttributes("H3 paling", "", "").treatment_class).not.toBe("H3.2");
    expect(parseProductAttributes("H3.2 joist", "", "").treatment_class).not.toBe("H3");
  });
});

describe("parseProductAttributes — sizes and dimensions", () => {
  it('parses "90x45" as 2-number size with width/height', () => {
    const a = parseProductAttributes("H1.2 Framing Timber 90x45mm", "per metre", "");
    expect(a.size).toBe("90x45");
    expect(a.width_mm).toBe(90);
    expect(a.height_mm).toBe(45);
  });

  it('parses "2400x1200x10mm" as sheet_size (2400x1200) + thickness (10mm)', () => {
    const a = parseProductAttributes("GIB Standard 2400x1200x10mm", "per sheet", "");
    expect(a.sheet_size).toBe("2400x1200");
    expect(a.width_mm).toBe(2400);
    expect(a.height_mm).toBe(1200);
    expect(a.thickness_mm).toBe(10);
  });

  it("parses standalone thickness when no 3-number sheet pattern", () => {
    const a = parseProductAttributes("13mm GIB Aqualine 2400x1200", "per sheet", "");
    expect(a.thickness_mm).toBe(13);
  });

  it("does not accidentally treat 90x45 width as thickness", () => {
    const a = parseProductAttributes("H1.2 Framing 90x45mm", "per metre", "");
    expect(a.thickness_mm).toBeUndefined();
  });
});

describe("parseProductAttributes — R-values, brands, lengths, finishes", () => {
  it("parses R-values from insulation rows", () => {
    expect(parseProductAttributes("Pink Batts R2.6 Ceiling 1160x430x140mm", "per bale", "")
      .r_value).toBe("R2.6");
  });

  it("identifies brand from product name", () => {
    expect(parseProductAttributes("GIB Standard 2400x1200x10mm", "", "").brand).toBe("GIB");
    expect(parseProductAttributes("Pink Batts R1.8 Wall", "", "").brand).toBe("Pink Batts");
    expect(parseProductAttributes("James Hardie Linea 180mm", "", "").brand).toBe("James Hardie");
  });

  it('parses "per 2.4m" length from unit field', () => {
    expect(parseProductAttributes("Fence Paling 100x19mm", "per 2.4m", "").length_m).toBe(2.4);
  });

  it("parses trailing length from product name", () => {
    expect(parseProductAttributes("Threaded Rod M20 x 2m", "per length", "").length_m).toBe(2);
  });

  it("preserves stainless / galvanised finish distinction", () => {
    expect(parseProductAttributes("Stainless Decking Screws", "per pack", "").finish).toBe("stainless");
    expect(parseProductAttributes("Galvanised Joist Hanger", "per unit", "").finish).toBe("galvanised");
  });

  it("never treats stainless as galvanised or vice versa", () => {
    const a = parseProductAttributes("Stainless Decking Screws", "", "");
    expect(a.finish).toBe("stainless");
    expect(a.finish).not.toBe("galvanised");
  });
});

describe("csvRowToMaterial — Est_Price IS NEVER COPIED", () => {
  it("default_unit_price is null even when Est_Price is set", () => {
    const m = csvRowToMaterial(sample({ Est_Price: "$3.50" }))!;
    expect(m.default_unit_price).toBeNull();
  });

  it("default_unit_price is null even when Est_Price is absent", () => {
    const m = csvRowToMaterial(sample({ Est_Price: "" }))!;
    expect(m.default_unit_price).toBeNull();
  });

  it("default_unit_price is null even with weird Est_Price formatting", () => {
    const m = csvRowToMaterial(sample({ Est_Price: "$1,234.56 (TBC)" }))!;
    expect(m.default_unit_price).toBeNull();
  });
});

describe("csvRowToMaterial — flag fields", () => {
  it("supplier = 'Mitre 10'", () => {
    expect(csvRowToMaterial(sample())!.supplier).toBe("Mitre 10");
  });
  it("price_source = 'csv_import' (existing CHECK-allowed value, not 'none')", () => {
    expect(csvRowToMaterial(sample())!.price_source).toBe("csv_import");
  });
  it("price_confidence = 'low'", () => {
    expect(csvRowToMaterial(sample())!.price_confidence).toBe("low");
  });
  it("attributes carry source/verified/is_priced flags", () => {
    const m = csvRowToMaterial(sample())!;
    expect(m.attributes.source).toBe("kimi_material_library");
    expect(m.attributes.verified).toBe(false);
    expect(m.attributes.is_priced).toBe(false);
  });
  it("attributes record verbatim CSV category", () => {
    const m = csvRowToMaterial(sample())!;
    expect(m.attributes.csv_category).toBe("TIMBER & WOOD");
  });
  it("active = true, gst_included = true, country = 'NZ'", () => {
    const m = csvRowToMaterial(sample())!;
    expect(m.active).toBe(true);
    expect(m.gst_included).toBe(true);
    expect(m.country).toBe("NZ");
  });
  it("user_id is null (global reference row, never user-scoped)", () => {
    expect(csvRowToMaterial(sample())!.user_id).toBeNull();
  });
});

describe("csvRowToMaterial — categorisation", () => {
  it("TIMBER & WOOD → timber", () => {
    expect(csvRowToMaterial(sample({ Category: "TIMBER & WOOD" }))!.category).toBe("timber");
  });
  it("PLASTERBOARD & LININGS → plasterboard", () => {
    expect(csvRowToMaterial(sample({ Category: "PLASTERBOARD & LININGS", Product: "GIB Standard 2400x1200x10mm" }))!
      .category).toBe("plasterboard");
  });
  it("INSULATION → insulation", () => {
    expect(csvRowToMaterial(sample({ Category: "INSULATION", Product: "Pink Batts R2.6 Ceiling" }))!.category)
      .toBe("insulation");
  });
  it("FASTENERS & HARDWARE → fixing", () => {
    expect(csvRowToMaterial(sample({ Category: "FASTENERS & HARDWARE", Product: "Stainless Decking Screws" }))!
      .category).toBe("fixing");
  });
  it("ROOFING & GUTTERS → roofing", () => {
    expect(csvRowToMaterial(sample({ Category: "ROOFING & GUTTERS", Product: "Colorsteel 0.55mm" }))!.category)
      .toBe("roofing");
  });
  it("CONCRETE & CEMENT → concrete", () => {
    expect(csvRowToMaterial(sample({ Category: "CONCRETE & CEMENT", Product: "Concrete Mix 25kg" }))!.category)
      .toBe("concrete");
  });
  it("unsupported category → null (skipped)", () => {
    expect(csvRowToMaterial(sample({ Category: "PAINT" }))).toBeNull();
  });
  it("empty product → null", () => {
    expect(csvRowToMaterial(sample({ Product: "" }))).toBeNull();
  });
});

describe("csvRowToMaterial — battens vs Pink Batts (regression)", () => {
  it("'Timber Battens 50x50' → category=timber, brand≠Pink Batts", () => {
    const m = csvRowToMaterial(sample({
      Category: "TIMBER & WOOD",
      Product: "H3.2 Pine Batten 50x50mm",
      Notes: "",
    }))!;
    expect(m.category).toBe("timber");
    expect(m.brand).not.toBe("Pink Batts");
  });
  it("'Pink Batts Wall' → category=insulation, brand=Pink Batts", () => {
    const m = csvRowToMaterial(sample({
      Category: "INSULATION",
      Product: "Pink Batts R1.8 Wall 1160x430x90mm",
      Notes: "",
    }))!;
    expect(m.category).toBe("insulation");
    expect(m.brand).toBe("Pink Batts");
  });
});

describe("csvRowToMaterial — GIB Aqualine vs GIB Standard", () => {
  it("GIB Aqualine row preserves brand=GIB; product name remains distinct from Standard", () => {
    const m = csvRowToMaterial(sample({
      Category: "PLASTERBOARD & LININGS",
      Product: "GIB Aqualine 2400x1200x13mm",
      Notes: "",
    }))!;
    expect(m.brand).toBe("GIB");
    expect(m.name).toContain("Aqualine");
    expect(m.name).not.toContain("Standard");
  });
});

describe("deterministicId — idempotency anchor", () => {
  it("same (supplier, product, unit) → same UUID", () => {
    const a = deterministicId("Mitre 10", "H1.2 Framing 90x45mm", "per metre");
    const b = deterministicId("Mitre 10", "H1.2 Framing 90x45mm", "per metre");
    expect(a).toBe(b);
  });

  it("different unit → different UUID (length variants stay distinct)", () => {
    const a = deterministicId("Mitre 10", "Fence Paling 100x19mm", "per 1.8m");
    const b = deterministicId("Mitre 10", "Fence Paling 100x19mm", "per 2.1m");
    expect(a).not.toBe(b);
  });

  it("UUID matches v4 shape", () => {
    const id = deterministicId("Mitre 10", "X", "each");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("csvToMaterials — dedupe + summary", () => {
  it("dedupes by (supplier, product, unit)", () => {
    const rows: CsvRow[] = [
      sample({ Product: "X", Unit: "each" }),
      sample({ Product: "X", Unit: "each" }), // exact dup
      sample({ Product: "X", Unit: "per pack" }), // distinct unit
    ];
    const { materials, summary } = csvToMaterials(rows);
    expect(materials).toHaveLength(2);
    expect(summary.duplicatesSkipped).toBe(1);
  });

  it("skips empty products", () => {
    const { summary } = csvToMaterials([sample({ Product: "" })]);
    expect(summary.emptyProductSkipped).toBe(1);
  });

  it("skips unsupported categories", () => {
    const { summary } = csvToMaterials([sample({ Category: "FAKE CATEGORY" })]);
    expect(summary.unsupportedCategorySkipped).toBe(1);
  });
});

describe("materialsToInsertSql — never produces price values", () => {
  it("emitted SQL contains no $-prefixed price tokens or numeric default_unit_price values", () => {
    const m = csvRowToMaterial(sample({ Est_Price: "$3.50" }))!;
    const [sql] = materialsToInsertSql([m]);
    expect(sql).not.toMatch(/\$3\.50/);
    expect(sql).not.toMatch(/3\.50,/); // would only appear if the price were inserted
    // The default_unit_price column must be inserted as the literal `null`.
    expect(sql).toMatch(/, null,/);
  });

  it("batches into chunks of <= batchSize", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      sample({ Product: `Stuff ${i}` }),
    );
    const mats = rows.map((r) => csvRowToMaterial(r)!);
    const sqls = materialsToInsertSql(mats, 2);
    expect(sqls).toHaveLength(3); // 2+2+1
  });

  it("includes ON CONFLICT DO NOTHING for idempotency", () => {
    const m = csvRowToMaterial(sample())!;
    const [sql] = materialsToInsertSql([m]);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
  });
});

describe("assertNotProduction — production guard", () => {
  it("throws if URL contains the production project ref", () => {
    expect(() => assertNotProduction("https://guiovuqccbzlbacaxepd.supabase.co"))
      .toThrow(/Refusing to import into the production project/);
  });
  it("allows non-production URLs", () => {
    expect(() => assertNotProduction("https://wkspwsorlgwkuwjajsce.supabase.co")).not.toThrow();
  });
});

describe("applyImport — batched upsert with onConflict ignoreDuplicates", () => {
  it("calls supabase.from('materials').upsert in batches with ignoreDuplicates", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = vi.fn(() => ({ upsert }));
    const supabase = { from: fromMock } as never;

    const mats = Array.from({ length: 7 }, (_, i) =>
      csvRowToMaterial(sample({ Product: `Stuff ${i}` }))!,
    );
    const result = await applyImport(supabase, mats, 3);
    expect(result).toEqual({ ok: 7, total: 7 });
    expect(upsert).toHaveBeenCalledTimes(3); // 3 + 3 + 1
    for (const call of upsert.mock.calls) {
      expect(call[1]).toEqual({ onConflict: "id", ignoreDuplicates: true });
    }
  });

  it("throws on batch error with descriptive message", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValue({ error: { message: "RLS denied" } });
    const supabase = { from: () => ({ upsert }) } as never;
    const m = csvRowToMaterial(sample())!;
    await expect(applyImport(supabase, [m])).rejects.toThrow(/RLS denied/);
  });
});
