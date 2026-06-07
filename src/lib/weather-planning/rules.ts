// ── Job-type rules: typed canonical copy of the DB seed ────────────────────
// The live source of truth is the job_type_rules table (migration
// 20260608_weather_planning.sql). This module is the SAME data, typed, used as:
//   • a fallback if the table read fails, and
//   • fixtures for the risk-engine unit tests.
// Keep these in sync with the migration seed. Thresholds are taken verbatim
// from the product spec.

import type { JobTypeRule } from "./types";

const MEDIUM_HIGH_ACTIONS = {
  medium: ["review schedule", "prepare alternate indoor work", "warn crew"],
  high: ["recommend reschedule", "offer job swap", "prepare customer message"],
};

export const JOB_TYPE_RULES: JobTypeRule[] = [
  {
    job_type: "roofing",
    display_name: "Roofing",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.2, high: 0.8 },
      wind_kmh: { medium: 20, high: 30 },
      gust_kmh: { medium: 30, high: 45 },
      lightning_or_storm: true,
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
  {
    job_type: "exterior_painting",
    display_name: "Exterior painting",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.1, high: 0.5 },
      precip_probability: { medium: 40, high: 60 },
      temperature_c: { low_min: 10, high_max: 30 },
      humidity_percent: { medium: 80, high: 90 },
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
  {
    job_type: "fencing",
    display_name: "Fencing",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.5, high: 1.5 },
      wind_kmh: { medium: 25, high: 40 },
      gust_kmh: { medium: 35, high: 55 },
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
  {
    job_type: "decking",
    display_name: "Decking / exterior carpentry",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.5, high: 1.5 },
      wind_kmh: { medium: 25, high: 40 },
      gust_kmh: { medium: 35, high: 55 },
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
  {
    job_type: "concrete",
    display_name: "Concrete / slab",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.2, high: 1.0 },
      temperature_c: { low_min: 5, high_max: 28 },
    },
    default_actions: {
      medium: ["review schedule", "move earlier in the day", "warn crew"],
      high: ["move earlier or reschedule", "protect the pour", "prepare customer message"],
    },
  },
  {
    job_type: "excavation",
    display_name: "Excavation / earthworks",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 1.0, high: 3.0 },
      precip_probability: { medium: 60, high: 80 },
    },
    default_actions: {
      medium: ["review schedule", "check ground conditions", "warn crew"],
      high: ["recommend reschedule", "offer job swap", "prepare customer message"],
    },
  },
  {
    job_type: "landscaping",
    display_name: "Landscaping",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.8, high: 2.0 },
      temperature_c: { low_min: 2, high_max: 32 },
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
  {
    job_type: "solar_install",
    display_name: "Solar install",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.2, high: 0.8 },
      wind_kmh: { medium: 20, high: 30 },
      gust_kmh: { medium: 30, high: 45 },
      lightning_or_storm: true,
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
  {
    job_type: "plumbing_service",
    display_name: "Plumbing service",
    outdoor: false,
    risk_thresholds: {
      flood_alert: true,
      lightning_or_storm: true,
    },
    default_actions: {
      medium: ["review schedule", "warn crew"],
      high: ["recommend reschedule", "prepare customer message"],
    },
  },
  {
    job_type: "electrical_outdoor",
    display_name: "Outdoor electrical",
    outdoor: true,
    risk_thresholds: {
      rain_mm_per_hour: { medium: 0.1, high: 0.5 },
      lightning_or_storm: true,
      wind_kmh: { medium: 20, high: 30 },
    },
    default_actions: MEDIUM_HIGH_ACTIONS,
  },
];

const BY_TYPE = new Map(JOB_TYPE_RULES.map((r) => [r.job_type, r]));

/** Look up a rule by job_type from the typed fallback set. */
export function getRuleFallback(jobType: string): JobTypeRule | null {
  return BY_TYPE.get(jobType) ?? null;
}

/** All known job-type ids (for UI selectors / validation). */
export const JOB_TYPE_IDS = JOB_TYPE_RULES.map((r) => r.job_type);

/**
 * Normalise an arbitrary DB row (job_type_rules.Row) into a typed JobTypeRule.
 * The DB stores thresholds/actions as Json; we cast defensively here so the
 * engine always gets the strict shape.
 */
export function ruleFromRow(row: {
  job_type: string;
  display_name: string;
  outdoor: boolean;
  risk_thresholds: unknown;
  default_actions: unknown;
}): JobTypeRule {
  return {
    job_type: row.job_type,
    display_name: row.display_name,
    outdoor: row.outdoor,
    risk_thresholds: (row.risk_thresholds ?? {}) as JobTypeRule["risk_thresholds"],
    default_actions: (row.default_actions ?? {}) as JobTypeRule["default_actions"],
  };
}
