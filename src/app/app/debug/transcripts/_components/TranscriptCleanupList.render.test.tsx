import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

import { TranscriptCleanupList } from "./TranscriptCleanupList";
import type { TranscriptCleanupRow } from "@/lib/transcript/debugView";

const row: TranscriptCleanupRow & { number: string } = {
  id: "q123",
  number: "Q-2026-0001",
  createdAt: "2026-05-24T00:00:00.000Z",
  raw: "order from place makers and james hardy",
  cleaned: "order from PlaceMakers and James Hardie",
  confidence: 0.82,
  corrections: [
    {
      before: "place makers",
      after: "PlaceMakers",
      type: "supplier",
      index: 11,
      source: "global",
      reason: "known variant of PlaceMakers",
      confidence: 0.95,
    },
  ],
  clarifications: [
    {
      id: "transcript.vocab.30",
      question: 'Did you mean "Coloursteel" instead of "colourstel"?',
      why: "close but not an exact match",
      phrase: "colourstel",
    },
  ],
};

describe("TranscriptCleanupList — empty", () => {
  const html = renderToStaticMarkup(
    createElement(TranscriptCleanupList, { rows: [] }),
  );
  it("shows an empty state mentioning raw is preserved", () => {
    expect(html).toContain('data-testid="transcript-cleanup-empty"');
    expect(html).toMatch(/raw transcript is always preserved/i);
  });
});

describe("TranscriptCleanupList — populated", () => {
  const html = renderToStaticMarkup(
    createElement(TranscriptCleanupList, { rows: [row] }),
  );

  it("shows raw vs cleaned", () => {
    expect(html).toContain("// raw");
    expect(html).toContain("// cleaned");
    expect(html).toContain("order from place makers and james hardy");
    expect(html).toContain("order from PlaceMakers and James Hardie");
  });

  it("shows the correction before/after, source and confidence", () => {
    expect(html).toContain('data-testid="transcript-correction"');
    expect(html).toContain("place makers");
    expect(html).toContain("PlaceMakers");
    expect(html).toContain("global");
    expect(html).toContain("95%");
    expect(html).toContain("known variant of PlaceMakers");
  });

  it("shows flagged clarifications", () => {
    expect(html).toContain('data-testid="transcript-clarification"');
    expect(html).toContain("Coloursteel");
  });

  it("links to the source quote", () => {
    expect(html).toContain("/app/quotes/preview/q123");
  });
});
