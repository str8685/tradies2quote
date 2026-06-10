// ── Assessment freshness (pure) ────────────────────────────────────────────
// Trust labels for stored weather assessments. The cron cadence (evening /
// morning / pre-job) means a healthy pipeline re-assesses every scheduled
// job at least every ~12h — so an assessment older than that is STALE and
// must be cued, never presented as current.
//
// Fail closed: an unparseable/missing timestamp counts as stale.

export const ASSESSMENT_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function isAssessmentStale(
  generatedAtISO: string | null | undefined,
  nowISO: string,
): boolean {
  const generated = Date.parse(generatedAtISO ?? "");
  const now = Date.parse(nowISO);
  if (!Number.isFinite(generated) || !Number.isFinite(now)) return true;
  return now - generated > ASSESSMENT_STALE_AFTER_MS;
}

/**
 * Compact relative age for the trust line: "just now", "Nm ago",
 * "Nh ago", "Nd ago". Unknown timestamps render "unknown" (and the
 * stale check above already fails closed for them).
 */
export function relativeAge(
  generatedAtISO: string | null | undefined,
  nowISO: string,
): string {
  const generated = Date.parse(generatedAtISO ?? "");
  const now = Date.parse(nowISO);
  if (!Number.isFinite(generated) || !Number.isFinite(now)) return "unknown";
  const ms = Math.max(0, now - generated);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
