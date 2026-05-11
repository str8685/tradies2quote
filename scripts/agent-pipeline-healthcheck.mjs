#!/usr/bin/env node
/**
 * Agent monitor pipeline health-check.
 *
 * What this verifies:
 *   1. Both env vars exist (AGENT_DASHBOARD_URL, AGENT_DASHBOARD_SECRET)
 *      and the secret meets the ≥16-char rule the logger enforces.
 *   2. The dashboard's POST /api/ingest/agent-event endpoint accepts a
 *      probe with the configured secret and returns `{ok:true}`.
 *   3. The wrong-secret path still returns 401 (defense-in-depth check).
 *
 * Usage:
 *   node scripts/agent-pipeline-healthcheck.mjs
 *
 * Reads env vars from process.env (so it works in Vercel CI, local
 * `.env.local`-sourced shells, or one-off `AGENT_DASHBOARD_URL=... node
 * scripts/...` invocations). Exits 0 on success, 1 on any failure.
 *
 * Never logs the full secret — only first 4 + last 4 + length.
 */

const PROJECT_SLUG = "tradies2quote";
const ENDPOINT_PATH = "/api/ingest/agent-event";
const HEADER = "x-agent-dashboard-secret";

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

async function probe(url, headers, body) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text, ms: Date.now() - start };
  } catch (err) {
    return {
      status: 0,
      body: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    };
  }
}

async function main() {
  console.log("Agent monitor pipeline health-check\n");

  const url = process.env.AGENT_DASHBOARD_URL;
  const secret = process.env.AGENT_DASHBOARD_SECRET;

  console.log("1. Env vars");
  if (!url) {
    fail("AGENT_DASHBOARD_URL is missing");
  } else {
    pass(`AGENT_DASHBOARD_URL = ${url}`);
  }
  if (!secret) {
    fail("AGENT_DASHBOARD_SECRET is missing");
  } else if (secret.length < 16) {
    fail(`AGENT_DASHBOARD_SECRET is too short (${secret.length} < 16)`);
  } else {
    pass(
      `AGENT_DASHBOARD_SECRET present (${secret.slice(0, 4)}...${secret.slice(-4)}, ${secret.length} chars)`,
    );
  }
  if (!url || !secret || secret.length < 16) {
    console.error("\nMissing/invalid env vars — aborting live probe.");
    process.exit(process.exitCode || 1);
  }

  const ingest = url.replace(/\/+$/, "") + ENDPOINT_PATH;
  const marker = Date.now();
  const body = {
    project: PROJECT_SLUG,
    type: "event",
    agent: "Pipeline Healthcheck",
    action: "healthcheck.probe",
    status: "complete",
    message: `healthcheck marker ${marker}`,
  };

  console.log("\n2. Wrong-secret path (expect HTTP 401)");
  const wrong = await probe(
    ingest,
    { [HEADER]: "deliberately-wrong-of-correct-length-1234567890ab" },
    body,
  );
  if (wrong.status === 401) {
    pass(`HTTP 401 in ${wrong.ms}ms — secret check is live`);
  } else {
    fail(
      `Expected 401 from wrong-secret probe, got ${wrong.status} (body: ${wrong.body.slice(0, 120)})`,
    );
  }

  console.log("\n3. Right-secret path (expect HTTP 200 {ok:true})");
  const ok = await probe(ingest, { [HEADER]: secret }, body);
  if (ok.status === 200 && /"ok"\s*:\s*true/.test(ok.body)) {
    pass(`HTTP 200 in ${ok.ms}ms — event accepted (marker ${marker})`);
  } else {
    fail(
      `Right-secret probe failed: HTTP ${ok.status} (body: ${ok.body.slice(0, 200)})`,
    );
  }

  console.log("");
  if (process.exitCode && process.exitCode !== 0) {
    console.error("Health-check FAILED.");
    process.exit(process.exitCode);
  }
  console.log("Health-check PASSED. Pipeline is live.");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
