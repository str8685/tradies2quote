import { describe, expect, it } from "vitest";
import {
  buildOpenAIRequestBody,
  extractOpenAIToolCall,
  runOpenAIStructuredAgent,
  type OpenAIContentBlock,
} from "../openai-runtime";

const TOOL = {
  name: "emit_plan",
  description: "Return the plan",
  schema: { type: "object", properties: { ok: { type: "boolean" } } },
};

/** OpenAI-shaped response with a forced function call (arguments = JSON string). */
function fnResponse(args: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: "emit_plan", arguments: JSON.stringify(args) } },
            ],
          },
        },
      ],
    }),
  } as unknown as Response;
}

function fakeFetch(responses: Response[]) {
  const bodies: Record<string, unknown>[] = [];
  let i = 0;
  const impl = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return responses[Math.min(i++, responses.length - 1)];
  }) as unknown as typeof fetch;
  return { impl, bodies };
}

describe("buildOpenAIRequestBody", () => {
  it("forces the function via tool_choice", () => {
    const body = buildOpenAIRequestBody({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      tool: TOOL,
      maxTokens: 100,
      temperature: 0,
    });
    expect(body.tool_choice).toEqual({
      type: "function",
      function: { name: "emit_plan" },
    });
    const tools = body.tools as Array<{ function: { name: string; parameters: unknown } }>;
    expect(tools[0].function.name).toBe("emit_plan");
    expect(tools[0].function.parameters).toBe(TOOL.schema);
  });
});

describe("extractOpenAIToolCall", () => {
  it("parses the function arguments JSON string", () => {
    expect(
      extractOpenAIToolCall(
        {
          choices: [
            { message: { tool_calls: [{ function: { name: "emit_plan", arguments: '{"ok":true}' } }] } },
          ],
        },
        "emit_plan",
      ),
    ).toEqual({ ok: true });
  });

  it("throws when the function call is missing", () => {
    expect(() => extractOpenAIToolCall({ choices: [{ message: {} }] }, "emit_plan")).toThrow(
      /did not call/,
    );
  });

  it("throws when arguments aren't valid JSON", () => {
    expect(() =>
      extractOpenAIToolCall(
        { choices: [{ message: { tool_calls: [{ function: { name: "emit_plan", arguments: "{bad" } }] } }] },
        "emit_plan",
      ),
    ).toThrow(/not valid JSON/);
  });
});

describe("runOpenAIStructuredAgent", () => {
  const okParse = (input: unknown) =>
    typeof (input as { ok?: unknown }).ok === "boolean"
      ? ({ ok: true as const, value: input as { ok: boolean } })
      : ({ ok: false as const, error: "ok must be boolean" });

  it("returns the validated value on the happy path", async () => {
    const { impl } = fakeFetch([fnResponse({ ok: true })]);
    const res = await runOpenAIStructuredAgent({
      agentName: "Test",
      system: "S",
      user: "U",
      tool: TOOL,
      parse: okParse,
      apiKey: "key",
      fetchImpl: impl,
    });
    expect(res.value).toEqual({ ok: true });
    expect(res.attempts).toBe(1);
  });

  it("supports image content blocks", async () => {
    const { impl, bodies } = fakeFetch([fnResponse({ ok: true })]);
    const user: OpenAIContentBlock[] = [
      { type: "text", text: "look" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
    ];
    await runOpenAIStructuredAgent({
      agentName: "Test",
      system: "S",
      user,
      tool: TOOL,
      parse: okParse,
      apiKey: "key",
      fetchImpl: impl,
    });
    const msgs = bodies[0].messages as Array<{ role: string; content: unknown }>;
    expect(Array.isArray(msgs[1].content)).toBe(true);
  });

  it("retries once on invalid output then succeeds", async () => {
    const { impl } = fakeFetch([fnResponse({ ok: "nope" }), fnResponse({ ok: false })]);
    const res = await runOpenAIStructuredAgent({
      agentName: "Test",
      system: "S",
      user: "U",
      tool: TOOL,
      parse: okParse,
      apiKey: "key",
      fetchImpl: impl,
    });
    expect(res.value).toEqual({ ok: false });
    expect(res.attempts).toBe(2);
  });

  it("throws without an API key", async () => {
    const { impl } = fakeFetch([fnResponse({ ok: true })]);
    await expect(
      runOpenAIStructuredAgent({
        agentName: "Test",
        system: "S",
        user: "U",
        tool: TOOL,
        parse: okParse,
        apiKey: "",
        fetchImpl: impl,
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
