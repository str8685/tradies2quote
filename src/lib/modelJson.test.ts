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

