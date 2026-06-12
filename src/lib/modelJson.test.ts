import { describe, expect, it } from "vitest";
import { extractModelJsonObject, parseModelJsonObject } from "./modelJson";

describe("model JSON extraction", () => {
  it("parses plain JSON", () => {
    expect(parseModelJsonObject<{ ok: boolean }>('{"ok":true}')).toEqual({
      ok: true,
    });
  });

  it("extracts fenced JSON", () => {
    expect(
      parseModelJsonObject<{ value: number }>("```json\n{\"value\":42}\n```"),
    ).toEqual({ value: 42 });
  });

  it("extracts the first balanced JSON object from prose", () => {
    const text = 'Here you go:\n{"text":"brace } inside string","ok":true}\nDone.';
    expect(extractModelJsonObject(text)).toBe(
      '{"text":"brace } inside string","ok":true}',
    );
  });

  it("throws when no complete object exists", () => {
    expect(() => parseModelJsonObject("not json")).toThrow(/No JSON object/);
    expect(() => parseModelJsonObject('{"missing": true')).toThrow();
  });
});


// ─── Hostile / degraded model output ─────────────────────────────────────
// Real failure shapes seen from LLM responses: truncation at max_tokens,
// braces inside string values, preamble prose, escaped quotes. The extractor
// must either return the exact object or fail loudly — never a mangled slice.
describe("extractModelJsonObject — degraded output", () => {
  it("returns null for output truncated mid-object (max_tokens cutoff)", () => {
    const truncated = '{"quote_data": {"line_items": [{"description": "GIB 13mm", "qty": 4}';
    expect(extractModelJsonObject(truncated)).toBeNull();
  });

  it("ignores braces inside string values", () => {
    const tricky = '{"notes": "brace test } here { and more", "total": 5}';
    expect(JSON.parse(extractModelJsonObject(tricky)!)).toEqual({
      notes: "brace test } here { and more",
      total: 5,
    });
  });

  it("survives escaped quotes inside strings", () => {
    const esc = '{"description": "4x2 \\"H3.2\\" framing", "qty": 10}';
    expect(JSON.parse(extractModelJsonObject(esc)!)).toEqual({
      description: '4x2 "H3.2" framing',
      qty: 10,
    });
  });

  it("takes the FIRST balanced object when the model emits two", () => {
    const two = 'Here you go: {"a": 1} and also {"b": 2}';
    expect(extractModelJsonObject(two)).toBe('{"a": 1}');
  });

  it("handles a fenced block with leading prose stripped by trim path", () => {
    const fenced = '```json\n{"a": {"b": [1, 2, 3]}}\n```';
    expect(JSON.parse(extractModelJsonObject(fenced)!)).toEqual({ a: { b: [1, 2, 3] } });
  });

  it("parseModelJsonObject throws a clear error on refusal prose", () => {
    expect(() =>
      parseModelJsonObject("I can't produce a quote for that request."),
    ).toThrow(/No JSON object found/);
  });

  it("returns null for an unterminated string (cut mid-value)", () => {
    const cut = '{"description": "Pink Batts R3.2 ceiling insulati';
    expect(extractModelJsonObject(cut)).toBeNull();
  });
});
