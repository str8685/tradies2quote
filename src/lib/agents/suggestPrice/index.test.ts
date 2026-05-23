import { describe, expect, it, vi } from "vitest";
import { suggestPrice, suggestPriceAgentEnabledFromEnv } from "./index";
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
    usage_count: 0,
    is_ai_estimated: false,
    last_used_at: null,
  };
}

/** Build a Claude-shaped response whose text is the body after the "{" prefill. */
function claudeResponse(obj: unknown) {
  const text = JSON.stringify(obj).slice(1); // drop leading "{"
  return {
    ok: true,
    json: async () => ({ content: [{ type: "text", text }] }),
  } as unknown as Response;
}

describe("suggestPrice — deterministic short-circuit", () => {
  it("returns a high-confidence library suggestion WITHOUT calling the LLM", async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error("LLM must not be called on a strong library match");
    });
    const r = await suggestPrice({
      target: { description: "140x45 H3.2 SG8 Pine", quantity: 19, unit: "length" },
      library: [lib({ name: "140x45 H3.2 SG8 Pine", unit: "length", default_unit_price: 28.4 })],
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.recommendation.status).toBe("suggested");
    expect(r.recommendation.confidence).toBe("high");
    expect(r.recommendation.suggested_unit_price).toBe(28.4);
    expect(r.recommendation.recommended_action).toBe("use_once");
    expect(r.advisory_only).toBe(true);
  });

  it("routes to manual pricing WITHOUT the LLM when there's no internal evidence", async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error("LLM must not be called with zero evidence");
    });
    const r = await suggestPrice({
      target: { description: "kwila decking oil 4L", quantity: 1, unit: "each" },
      library: [lib({ name: "Concrete bag 20kg", default_unit_price: 12 })],
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.recommendation.status).toBe("needs_manual_pricing");
    expect(r.recommendation.suggested_unit_price).toBeNull();
  });
});

describe("suggestPrice — fuzzy path (LLM)", () => {
  it("calls the LLM for a partial match and returns the parsed suggestion", async () => {
    const modelJson = {
      recommendation: {
        status: "suggested",
        best_match_name: "Stainless screws box",
        best_match_material_id: "stainless-screws-box",
        suggested_unit_price: 85,
        suggested_price_range_low: 80,
        suggested_price_range_high: 92,
        confidence: "medium",
        should_save_mapping_if_accepted: true,
        recommended_action: "save_to_library",
      },
      reasoning: { summary: "Close match on a recent box price.", evidence_ranked: [], risk_flags: [], missing_information: [] },
      alternatives: [],
    };
    const fetchImpl = vi.fn(async () => claudeResponse(modelJson));
    const r = await suggestPrice({
      target: { description: "decking screws stainless", quantity: 2, unit: "box" },
      library: [lib({ name: "Stainless screws box", unit: "box", default_unit_price: 89 })],
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(r.recommendation.status).toBe("suggested");
    expect(r.recommendation.confidence).toBe("medium");
    expect(r.recommendation.suggested_unit_price).toBe(85);
  });

  it("falls back to manual when the LLM call is not ok", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false }) as unknown as Response);
    const r = await suggestPrice({
      target: { description: "decking screws stainless", quantity: 2, unit: "box" },
      library: [lib({ name: "Stainless screws box", unit: "box", default_unit_price: 89 })],
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.recommendation.status).toBe("needs_manual_pricing");
    expect(r.advisory_only).toBe(true);
  });

  it("falls back to manual when the LLM throws / returns junk", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "not json" }] }) }) as unknown as Response);
    const r = await suggestPrice({
      target: { description: "decking screws stainless", quantity: 2, unit: "box" },
      library: [lib({ name: "Stainless screws box", unit: "box", default_unit_price: 89 })],
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.recommendation.status).toBe("needs_manual_pricing");
  });
});

describe("suggestPriceAgentEnabledFromEnv", () => {
  it("is off unless explicitly enabled", () => {
    const prev = process.env.SUGGEST_PRICE_AGENT_ENABLED;
    delete process.env.SUGGEST_PRICE_AGENT_ENABLED;
    expect(suggestPriceAgentEnabledFromEnv()).toBe(false);
    process.env.SUGGEST_PRICE_AGENT_ENABLED = "true";
    expect(suggestPriceAgentEnabledFromEnv()).toBe(true);
    if (prev === undefined) delete process.env.SUGGEST_PRICE_AGENT_ENABLED;
    else process.env.SUGGEST_PRICE_AGENT_ENABLED = prev;
  });
});
