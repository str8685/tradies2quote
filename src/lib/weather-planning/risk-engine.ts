// ── Deterministic weather risk engine ──────────────────────────────────────
// HARD BOUNDARY: this is the ONLY place weather risk is decided. Every
// threshold comes from the job_type_rules row passed in — never from an LLM,
// never hard-coded here. Pat/Willa receive the OUTPUT of this engine and may
// only interpret it; they cannot change a risk level or a number.
//
// Risk is OR-combined across the window, NOT averaged: if ANY hour breaches a
// HIGH threshold the job is HIGH. This mirrors the plan-reader gate philosophy
// (worst-case wins) — a single dangerous hour during a pour or a roof lift is
// enough to flag the job.
//
// Pure + side-effect free → fully unit-tested (risk-engine.test.ts). The
// provider/orchestrator do the I/O; this module just decides.

import type {
  ForecastHour,
  ForecastSnapshot,
  JobTypeRule,
  RecommendedAction,
  RiskLevel,
  TriggerFired,
  WeatherAssessment,
} from "./types";

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function worse(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

/** Add a trigger if `observed` meets the high or medium band. Higher = worse. */
function checkUpperBand(
  metric: "rain_mm_per_hour" | "precip_probability" | "wind_kmh" | "gust_kmh" | "humidity_percent",
  band: { medium?: number; high?: number } | undefined,
  observed: number | null,
  time: string,
  out: TriggerFired[],
): void {
  if (band == null || observed == null) return;
  if (band.high != null && observed >= band.high) {
    out.push({ rule: `${metric}.high`, observed, threshold: band.high, window_time: time, risk: "high" });
  } else if (band.medium != null && observed >= band.medium) {
    out.push({ rule: `${metric}.medium`, observed, threshold: band.medium, window_time: time, risk: "medium" });
  }
}

/** Map a fired metric to its human risk category (for risk_types). */
const METRIC_CATEGORY: Record<string, string> = {
  rain_mm_per_hour: "rain",
  precip_probability: "rain",
  wind_kmh: "wind",
  gust_kmh: "wind",
  temperature_c: "temperature",
  humidity_percent: "humidity",
  lightning_or_storm: "storm",
  flood_alert: "flood",
};

export interface EvaluateArgs {
  jobId: string;
  rule: JobTypeRule;
  forecast: ForecastSnapshot;
  /** ISO clock used for generated_at; injected so the engine stays pure/testable. */
  now: string;
}

/**
 * Evaluate a forecast window against a trade's rules. Returns the full
 * deterministic assessment: every trigger fired (with observed vs threshold),
 * the OR-combined risk level, and the action/agent flags derived from it.
 */
export function evaluateJobWeather({ jobId, rule, forecast, now }: EvaluateArgs): WeatherAssessment {
  const t = rule.risk_thresholds;
  const triggers: TriggerFired[] = [];

  // ── Per-hour numeric thresholds ───────────────────────────────────────
  for (const hour of forecast.hourly) {
    checkUpperBand("rain_mm_per_hour", t.rain_mm_per_hour, hour.rain_mm, hour.time, triggers);
    checkUpperBand("precip_probability", t.precip_probability, hour.precip_probability, hour.time, triggers);
    checkUpperBand("wind_kmh", t.wind_kmh, hour.wind_kmh, hour.time, triggers);
    checkUpperBand("gust_kmh", t.gust_kmh, hour.gust_kmh, hour.time, triggers);
    checkUpperBand("humidity_percent", t.humidity_percent, hour.humidity_percent, hour.time, triggers);

    // Temperature: a single safe band. Breaching either end is a MEDIUM caution
    // (concrete won't cure too cold/hot, paint won't bond, etc.).
    if (t.temperature_c != null && hour.temperature_c != null) {
      const { low_min, high_max } = t.temperature_c;
      if (low_min != null && hour.temperature_c < low_min) {
        triggers.push({ rule: "temperature_c.low_min", observed: hour.temperature_c, threshold: low_min, window_time: hour.time, risk: "medium" });
      } else if (high_max != null && hour.temperature_c > high_max) {
        triggers.push({ rule: "temperature_c.high_max", observed: hour.temperature_c, threshold: high_max, window_time: hour.time, risk: "medium" });
      }
    }

    // Lightning / storm anywhere in the window is always HIGH when the trade
    // cares about it (roofing, solar, electrical, plumbing service callouts).
    if (t.lightning_or_storm === true && hour.lightning_or_storm === true) {
      triggers.push({ rule: "lightning_or_storm", observed: true, threshold: true, window_time: hour.time, risk: "high" });
    }
  }

  // ── Alert-based thresholds (whole-window) ─────────────────────────────
  for (const alert of forecast.alerts) {
    const type = alert.type.toLowerCase();
    if (t.lightning_or_storm === true && (type.includes("thunder") || type.includes("storm"))) {
      triggers.push({ rule: "lightning_or_storm", observed: true, threshold: true, window_time: forecast.window.start, risk: "high" });
    }
    if (t.flood_alert === true && type.includes("flood")) {
      triggers.push({ rule: "flood_alert", observed: true, threshold: true, window_time: forecast.window.start, risk: "high" });
    }
  }

  // ── OR-combine to an overall risk level (worst hour wins) ─────────────
  let riskLevel: RiskLevel = "low";
  for (const trig of triggers) riskLevel = worse(riskLevel, trig.risk);

  // Distinct categories that fired, in stable order.
  const riskTypes = uniqueInOrder(
    triggers.map((tr) => METRIC_CATEGORY[tr.rule.split(".")[0]] ?? tr.rule.split(".")[0]),
  );

  const recommendedAction = pickAction(riskLevel, rule.job_type);
  const customerCommsNeeded = riskLevel === "high";

  return {
    job_id: jobId,
    job_type: rule.job_type,
    provider: forecast.provider,
    generated_at: now,
    window: forecast.window,
    risk_level: riskLevel,
    risk_types: riskTypes,
    triggers_fired: triggers,
    summary: buildSummary(riskLevel, riskTypes, rule),
    recommended_action: recommendedAction,
    customer_comms_needed: customerCommsNeeded,
    // Pat interprets anything that isn't a clean "low". Willa only drafts comms
    // when the job is HIGH (customer impact). Both are gated by the engine, so
    // the LLMs never run for a clear day.
    pat_should_run: riskLevel !== "low",
    willa_should_run: customerCommsNeeded,
  };
}

/**
 * Deterministic action mapping. Concrete is the one trade where "move earlier"
 * is the right first move (pour before the rain) rather than a straight
 * reschedule; everything else escalates to reschedule/swap at HIGH.
 */
function pickAction(risk: RiskLevel, jobType: string): RecommendedAction {
  if (risk === "low") return "proceed";
  if (risk === "medium") return "proceed_with_caution";
  if (jobType === "concrete") return "move_earlier_or_reschedule";
  return "reschedule_or_swap";
}

function buildSummary(risk: RiskLevel, riskTypes: string[], rule: JobTypeRule): string {
  const job = `${rule.outdoor ? "outdoor " : ""}${rule.display_name.toLowerCase()} job`;
  if (risk === "low") {
    return `Low weather risk during the scheduled window for this ${job}.`;
  }
  const level = risk === "high" ? "High" : "Moderate";
  return `${level} risk of ${humanList(riskTypes)} during the scheduled work window for this ${job}.`;
}

function humanList(items: string[]): string {
  if (items.length === 0) return "adverse conditions";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function uniqueInOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/** Pick the worst single hour for a quick "site conditions" headline. */
export function worstHour(forecast: ForecastSnapshot): ForecastHour | null {
  return forecast.hourly[0] ?? null;
}
