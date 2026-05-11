import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  logAgentApprovalNeeded,
  logAgentError,
  logAgentEvent,
  logAgentStep,
} from "../logger";

/**
 * Snapshot of the env at the top of the run. We mutate process.env in
 * each test and restore after so test order can't leak state.
 */
const ENV_BACKUP = {
  url: process.env.AGENT_DASHBOARD_URL,
  secret: process.env.AGENT_DASHBOARD_SECRET,
};

function restoreEnv(): void {
  if (ENV_BACKUP.url === undefined) {
    delete process.env.AGENT_DASHBOARD_URL;
  } else {
    process.env.AGENT_DASHBOARD_URL = ENV_BACKUP.url;
  }
  if (ENV_BACKUP.secret === undefined) {
    delete process.env.AGENT_DASHBOARD_SECRET;
  } else {
    process.env.AGENT_DASHBOARD_SECRET = ENV_BACKUP.secret;
  }
}

describe("agent-monitor logger", () => {
  // Need a 16+ char secret because the logger enforces a minimum
  // length to match the dashboard's check on the receiving side.
  const TEST_SECRET = "test-secret-1234567890";
  const TEST_URL = "https://dashboard.example.com";

  let fetchSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      // Body is irrelevant for the helper; only that it resolves.
      new Response(null, { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("does nothing when AGENT_DASHBOARD_URL is missing", () => {
    delete process.env.AGENT_DASHBOARD_URL;
    process.env.AGENT_DASHBOARD_SECRET = TEST_SECRET;
    logAgentEvent({ agentName: "X", status: "complete" });
    logAgentStep({ agentName: "X", status: "complete" });
    logAgentError({ agentName: "X", status: "failed", message: "boom" });
    logAgentApprovalNeeded({
      agentName: "X",
      status: "waiting_approval",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when AGENT_DASHBOARD_SECRET is missing", () => {
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    delete process.env.AGENT_DASHBOARD_SECRET;
    logAgentEvent({ agentName: "X", status: "complete" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when AGENT_DASHBOARD_SECRET is too short", () => {
    // Matches the dashboard's `length < 16` reject.
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    process.env.AGENT_DASHBOARD_SECRET = "short";
    logAgentEvent({ agentName: "X", status: "complete" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs the sanitized payload to the dashboard when env vars exist", () => {
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    process.env.AGENT_DASHBOARD_SECRET = TEST_SECRET;
    logAgentStep({
      agentName: "Invoice Agent",
      runId: "run_abc_123",
      stepName: "rpc.start",
      status: "running",
      quoteId: "00000000-0000-0000-0000-000000000001",
      message: "Creating draft invoice",
      // The next four fields are accepted by the type but should NEVER
      // be transmitted — checked below.
      userId: "user_should_not_leak",
      metadata: { secret: "should not leak" },
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_001_000,
      durationMs: 240,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;

    expect(url).toBe(`${TEST_URL}/api/ingest/agent-event`);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);

    // Header carries the secret. No URL parameter ever.
    const headers = init.headers as Record<string, string>;
    expect(headers["x-agent-dashboard-secret"]).toBe(TEST_SECRET);
    expect(url.includes("?")).toBe(false);

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.project).toBe("tradies2quote");
    expect(body.type).toBe("event");
    expect(body.agent).toBe("Invoice Agent");
    expect(body.action).toBe("rpc.start");
    expect(body.status).toBe("running");
    expect(body.run_id).toBe("run_abc_123");
    expect(body.quote_id).toBe("00000000-0000-0000-0000-000000000001");
    // Duration folded into the message string.
    expect(body.message).toBe("Creating draft invoice · 240ms");

    // PII allow-list — these MUST NOT appear in the wire body.
    expect("user_id" in body).toBe(false);
    expect("userId" in body).toBe(false);
    expect("metadata" in body).toBe(false);
    expect("started_at" in body).toBe(false);
    expect("finished_at" in body).toBe(false);
    expect("duration_ms" in body).toBe(false);
  });

  it("logAgentError forces type=error and clamps long messages to 500 chars", () => {
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    process.env.AGENT_DASHBOARD_SECRET = TEST_SECRET;
    const big = "x".repeat(800);
    logAgentError({
      agentName: "Compliance Agent",
      status: "failed",
      message: big,
    });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.type).toBe("error");
    expect(body.status).toBe("failed");
    expect(
      typeof body.error_message === "string" &&
        (body.error_message as string).length <= 500,
    ).toBe(true);
  });

  it("logAgentApprovalNeeded forces waiting_approval + approval_required", () => {
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    process.env.AGENT_DASHBOARD_SECRET = TEST_SECRET;
    logAgentApprovalNeeded({
      agentName: "Invoice Agent",
      status: "waiting_approval",
      message: "Owner approval needed",
    });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.status).toBe("waiting_approval");
    expect(body.approval_required).toBe(true);
  });

  it("does not throw when fetch rejects, and warns on console", async () => {
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    process.env.AGENT_DASHBOARD_SECRET = TEST_SECRET;
    fetchSpy.mockRejectedValueOnce(new Error("network down"));

    // Synchronous call must not throw — fire-and-forget.
    expect(() =>
      logAgentEvent({ agentName: "X", status: "complete" }),
    ).not.toThrow();

    // Let the .catch() microtask + the warn call settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalled();
    const warnArgs = warnSpy.mock.calls[0] ?? [];
    expect(String(warnArgs[0] ?? "")).toContain("[agent-monitor]");
  });

  it("does not throw when fetch itself throws synchronously", () => {
    process.env.AGENT_DASHBOARD_URL = TEST_URL;
    process.env.AGENT_DASHBOARD_SECRET = TEST_SECRET;
    globalThis.fetch = (() => {
      throw new Error("fetch unavailable");
    }) as unknown as typeof fetch;
    expect(() =>
      logAgentEvent({ agentName: "X", status: "complete" }),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });
});

/* ----------------------------------------------------------------------
 * Static guard: no file marked "use client" may import the logger.
 *
 * Walks src/ once. Looks at any .ts/.tsx/.js/.jsx file that starts with
 * a "use client" pragma (within the first ~5 non-blank/non-comment
 * lines so this isn't trivially defeated by a leading docstring), and
 * fails the test if it also imports from `lib/agent-monitor/logger`.
 *
 * This catches accidental imports even if they happen to not throw at
 * runtime (a developer could shim around the `import "server-only"`
 * guard with a wrong path or an aliased import).
 * -------------------------------------------------------------------- */

describe("logger import boundary", () => {
  it("is never imported from a 'use client' file", async () => {
    const root = resolve(process.cwd(), "src");
    const offending: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        // Skip our own test file — it imports the logger by design.
        if (
          entry.name === "__tests__" ||
          entry.name === "node_modules" ||
          entry.name === ".next"
        ) {
          if (entry.isDirectory()) continue;
        }
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!/\.(t|j)sx?$/.test(entry.name)) continue;

        const content = await readFile(full, "utf8");
        // Look for the pragma near the top, robust to BOM and a few
        // leading comment / blank lines.
        const head = content.split(/\r?\n/, 12).join("\n");
        const isClient = /^[\s\S]*?["']use client["']/.test(head);
        if (!isClient) continue;
        if (
          content.includes('"@/lib/agent-monitor/logger"') ||
          content.includes("'@/lib/agent-monitor/logger'") ||
          content.includes("agent-monitor/logger")
        ) {
          offending.push(full);
        }
      }
    };

    await walk(root);
    expect(offending, `Client components importing the server-only logger`).toEqual([]);
  });
});
