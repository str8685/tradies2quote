import { describe, expect, it } from "vitest";
import type { QuoteData } from "../quote-types";
import {
  summariseTranscriptRows,
  toTranscriptCleanupRows,
  type QuoteRowInput,
} from "./debugView";

function quoteWithTranscript(transcript: unknown): QuoteData {
  return { transcript } as unknown as QuoteData;
}

describe("toTranscriptCleanupRows", () => {
  it("extracts raw/cleaned/corrections/clarifications/confidence", () => {
    const rows: QuoteRowInput[] = [
      {
        id: "q1",
        created_at: "2026-05-24T00:00:00.000Z",
        quote_data: quoteWithTranscript({
          raw: "from place makers",
          cleaned: "from PlaceMakers",
          confidence: 0.8,
          corrections: [
            {
              before: "place makers",
              after: "PlaceMakers",
              type: "supplier",
              index: 5,
              source: "global",
              reason: "known variant of PlaceMakers",
              confidence: 0.95,
            },
          ],
          clarification_questions: [
            { id: "transcript.vocab.1", question: "Did you mean X?", why: "...", phrase: "exx" },
          ],
        }),
      },
    ];
    const out = toTranscriptCleanupRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "q1",
      raw: "from place makers",
      cleaned: "from PlaceMakers",
      confidence: 0.8,
    });
    expect(out[0].corrections[0].after).toBe("PlaceMakers");
    expect(out[0].clarifications[0].phrase).toBe("exx");
  });

  it("drops quotes without a transcript layer", () => {
    const rows: QuoteRowInput[] = [
      { id: "q2", created_at: "x", quote_data: { line_items: [] } as unknown as QuoteData },
      { id: "q3", created_at: "x", quote_data: null },
    ];
    expect(toTranscriptCleanupRows(rows)).toHaveLength(0);
  });

  it("is defensive against malformed transcript fields", () => {
    const rows: QuoteRowInput[] = [
      {
        id: "q4",
        created_at: "x",
        quote_data: quoteWithTranscript({
          raw: "something",
          corrections: "not-an-array",
          clarification_questions: null,
        }),
      },
    ];
    const out = toTranscriptCleanupRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].corrections).toEqual([]);
    expect(out[0].clarifications).toEqual([]);
    expect(out[0].confidence).toBeNull();
  });
});

describe("summariseTranscriptRows", () => {
  it("totals quotes, corrections and clarifications", () => {
    const rows = toTranscriptCleanupRows([
      {
        id: "a",
        created_at: "x",
        quote_data: quoteWithTranscript({
          raw: "r",
          corrections: [{ before: "a", after: "b", type: "supplier", index: 0 }],
          clarification_questions: [
            { id: "1", question: "q", why: "w", phrase: "p" },
            { id: "2", question: "q", why: "w", phrase: "p" },
          ],
        }),
      },
    ]);
    expect(summariseTranscriptRows(rows)).toEqual({
      quotes: 1,
      corrections: 1,
      clarifications: 2,
    });
  });
});
