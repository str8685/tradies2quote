// ─────────────────────────────────────────────────────────────────────────
// OpenAI structured runtime — the OpenAI sibling of runtime.ts.
//
// Same contract as the Anthropic runtime, but speaks OpenAI Chat Completions:
//   - Structured output via FUNCTION CALLING — the model is forced to call one
//     tool whose `parameters` schema shapes the result. We read the tool call's
//     `arguments` (a JSON string) instead of parsing free text.
//   - Validation + one retry — caller's parse() validates/normalises.
//   - Observability — logs run.start / run.finish to agent-monitor.
//   - Vision-ready — user content may include image_url blocks.
//
// (OpenAI caches long prompts automatically, so there's no cache_control to
// set — the caching win is free.)
//
// Pure builder + extractor are exported for unit tests; the orchestrator takes
// an injectable fetch.
// ─────────────────────────────────────────────────────────────────────────
import "server-only";
import {
  logAgentRunFinish,
  logAgentRunStart,
  newRunId,
} from "@/lib/agent-monitor/logger";
import { fetchWithTimeout, TIMEOUTS } from "@/lib/fetchTimeout";
import type { ParseResult } from "./runtime";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type OpenAIContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenAIStructuredOptions<T> {
  agentName: string;
  system: string;
  user: string | OpenAIContentBlock[];
  tool: { name: string; description: string; schema: Record<string, unknown> };
  parse: (input: unknown) => ParseResult<T>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  runId?: string;
  quoteId?: string;
  userId?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface OpenAIStructuredResult<T> {
  value: T;
  model: string;
  attempts: number;
}

interface OpenAIMessage {
  role: "system" | "user";
  content: string | OpenAIContentBlock[];
}

/** Build the OpenAI Chat Completions request body. Pure — no I/O. */
export function buildOpenAIRequestBody(args: {
  model: string;
  messages: OpenAIMessage[];
  tool: { name: string; description: string; schema: Record<string, unknown> };
  maxTokens: number;
  temperature: number;
}): Record<string, unknown> {
  return {
    model: args.model,
    max_tokens: args.maxTokens,
    temperature: args.temperature,
    messages: args.messages,
    tools: [
      {
        type: "function",
        function: {
          name: args.tool.name,
          description: args.tool.description,
          parameters: args.tool.schema,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: args.tool.name },
    },
  };
}

interface OpenAIResponsePayload {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

/**
 * Pull the forced function call's parsed arguments out of a response. Pure.
 * OpenAI returns `arguments` as a JSON STRING — we parse it here.
 */
export function extractOpenAIToolCall(
  payload: OpenAIResponsePayload,
  toolName: string,
): unknown {
  const call = payload.choices?.[0]?.message?.tool_calls?.find(
    (c) => c.function?.name === toolName,
  );
  const argStr = call?.function?.arguments;
  if (typeof argStr !== "string") {
    throw new Error(`Model did not call the expected "${toolName}" function.`);
  }
  try {
    return JSON.parse(argStr);
  } catch (e) {
    throw new Error(
      `Function "${toolName}" arguments were not valid JSON: ${(e as Error).message}`,
    );
  }
}

export async function runOpenAIStructuredAgent<T>(
  opts: OpenAIStructuredOptions<T>,
): Promise<OpenAIStructuredResult<T>> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const doFetch = opts.fetchImpl ?? fetch;
  const model = opts.model ?? "gpt-4o-mini";
  const maxTokens = opts.maxTokens ?? 1500;
  const temperature = opts.temperature ?? 0;
  const runId = opts.runId ?? newRunId(opts.agentName.toLowerCase());

  const messages: OpenAIMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  logAgentRunStart({
    agentName: opts.agentName,
    runId,
    status: "running",
    message: `Started (${model})`,
    quoteId: opts.quoteId,
    userId: opts.userId,
  });

  const MAX_ATTEMPTS = 2;
  let lastError = "";

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const body = buildOpenAIRequestBody({
        model,
        messages,
        tool: opts.tool,
        maxTokens,
        temperature,
      });

      const res = await fetchWithTimeout(
        OPENAI_URL,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
        TIMEOUTS.llm,
        doFetch,
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
      }

      const payload = (await res.json()) as OpenAIResponsePayload;

      let input: unknown;
      try {
        input = extractOpenAIToolCall(payload, opts.tool.name);
      } catch (e) {
        lastError = (e as Error).message;
        if (attempt < MAX_ATTEMPTS) {
          messages.push({
            role: "user",
            content: `You must respond by calling the "${opts.tool.name}" function with valid arguments.`,
          });
          continue;
        }
        throw e;
      }

      const parsed = opts.parse(input);
      if (parsed.ok) {
        logAgentRunFinish({
          agentName: opts.agentName,
          runId,
          status: "complete",
          message: `OK in ${attempt} attempt(s)`,
          quoteId: opts.quoteId,
          userId: opts.userId,
        });
        return { value: parsed.value, model, attempts: attempt };
      }

      lastError = parsed.error;
      if (attempt < MAX_ATTEMPTS) {
        messages.push({
          role: "user",
          content: `Your previous "${opts.tool.name}" call was invalid: ${parsed.error}. Call it again with corrected values.`,
        });
      }
    }

    throw new Error(
      `Agent "${opts.agentName}" failed validation after ${MAX_ATTEMPTS} attempts: ${lastError}`,
    );
  } catch (err) {
    logAgentRunFinish({
      agentName: opts.agentName,
      runId,
      status: "failed",
      message: `Failed: ${(err as Error).message}`.slice(0, 280),
      quoteId: opts.quoteId,
      userId: opts.userId,
    });
    throw err;
  }
}
