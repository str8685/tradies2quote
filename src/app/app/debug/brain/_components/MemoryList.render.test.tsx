import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// next/link needs router context renderToStaticMarkup doesn't provide.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => createElement("a", { href, ...rest }, children),
}));

import { MemoryList } from "./MemoryList";
import type { MemoryType, TradieMemory } from "@/lib/tradieBrain/types";

let n = 0;
function mem(
  p: Partial<TradieMemory> & { memory_type: MemoryType; memory_key: string },
): TradieMemory {
  n += 1;
  return {
    id: `m${n}`,
    user_id: "u1",
    value: {},
    strength: 1,
    source: "manual_pref",
    provenance: {},
    status: "active",
    first_seen_at: "2026-05-20T00:00:00.000Z",
    last_seen_at: "2026-05-20T00:00:00.000Z",
    last_used_at: null,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...p,
  };
}

describe("MemoryList — empty state", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryList, { memories: [] }),
  );
  it("explains what Tradie Brain will learn and that nothing is fed to AI", () => {
    expect(html).toContain('data-testid="brain-empty"');
    expect(html).toContain("No memories yet");
    expect(html).toMatch(/nothing is fed to the AI yet/i);
  });
});

describe("MemoryList — populated state", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryList, {
      memories: [
        mem({
          memory_type: "preferred_material",
          memory_key: "90x45 framing",
          strength: 4,
          value: { name: "90x45 H3.2 framing", unit: "LM", unit_price: 6.5 },
          source: "material_correction",
          provenance: { quote_id: "q123" },
        }),
        mem({
          memory_type: "pricing_habit",
          memory_key: "markup",
          strength: 2,
          value: { markup_pct: 18 },
        }),
      ],
    }),
  );

  it("groups by type with human labels", () => {
    expect(html).toContain("Preferred materials");
    expect(html).toContain("Pricing habits");
    expect(html).toContain('data-testid="brain-group-preferred_material"');
  });

  it("shows the learned value, derived confidence, and observation count", () => {
    expect(html).toContain("90x45 H3.2 framing — $6.5/LM");
    expect(html).toContain("Markup ~18%");
    // strength 4 → high; strength 2 → medium
    expect(html).toMatch(/high · ×4/);
    expect(html).toMatch(/medium · ×2/);
  });

  it("shows provenance: source + a link to the source quote", () => {
    expect(html).toMatch(/via material correction/);
    expect(html).toContain("/app/quotes/preview/q123");
    expect(html).toContain("source quote");
  });
});
