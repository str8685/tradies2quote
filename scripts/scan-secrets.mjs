#!/usr/bin/env node
/**
 * Stage 4 cutover pre-flight: real-key-prefix scan across tracked files.
 *
 * Fails CLOSED. Exits with:
 *   0  scan completed and zero hits
 *   1  scan completed and one or more hits found
 *   2  scan errored (cannot list files, etc.) — treat as "did not scan"
 *
 * The regex matches real key prefixes only:
 *   - sb_secret_   (Supabase service-role secrets)
 *   - re_…20+      (Resend keys; the 20+ alnum suffix avoids false-positives
 *                  on common English words like "request", "restore",
 *                  "redirect", "remove", "replace", "resolve", "response")
 *   - sk-proj-     (OpenAI project keys)
 *   - sk-ant-api   (Anthropic keys, with a digit-dash key body shape)
 *
 * SQL role names like 'service_role' are intentionally NOT in the regex —
 * migrations legitimately reference role names. This is the strict scan
 * that complements the loose env-var-name scan in Phase A2b.
 *
 * Migration files are NOT excluded; real keys must have zero hits anywhere.
 * Binary files are skipped (NUL byte in first 8 KB).
 *
 * Usage:
 *   node scripts/scan-secrets.mjs
 *   echo "scan exit: $?"
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const RX = /(sb_secret_[A-Za-z0-9_-]{6,}|\bre_[A-Za-z0-9]{20,}\b|sk-proj-[A-Za-z0-9_-]{6,}|sk-ant-api[0-9]+-[A-Za-z0-9_-]{6,})/;

let files;
try {
  files = execSync("git ls-files -z", { maxBuffer: 64 * 1024 * 1024 })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
} catch (err) {
  console.error(
    "scan failed: cannot list tracked files —",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(2);
}

let bad = 0;
for (const f of files) {
  let buf;
  try {
    buf = readFileSync(f);
  } catch {
    // Unreadable file (broken symlink, vanished file, etc.) — not a leak risk
    continue;
  }
  // Skip clearly binary files (NUL byte in first 8 KB)
  if (buf.subarray(0, 8192).includes(0)) continue;
  const m = buf.toString("utf8").match(RX);
  if (m) {
    bad++;
    // Truncate the match preview to 24 chars so we never echo a full key
    console.error(`LEAK ${f}: ${m[0].slice(0, 24)}…`);
  }
}

if (bad > 0) {
  console.error(`scan found ${bad} potential leak(s)`);
  process.exit(1);
}

console.log("scan: OK (zero key prefixes in tracked files)");
process.exit(0);
