// ── Weather-Aware Job Planning — shared types ──────────────────────────────
// One place for every JSON shape in the flow: rules → forecast snapshot →
// deterministic assessment → Pat/Willa agent payloads. Mirrors the product
// spec. See docs/weather-planning.md.

export type RiskLevel = "low" | "medium" | "high";

/** A medium/high numeric threshold band (higher observed = worse). */
export interface RiskBand {
  medium?: number;
  high?: number;
}

/** Temperature is a single safe band; breaching either end is a caution. */
export interface TempBand {
  low_min?: number;
  high_max?: number;
}

/**
 * Deterministic thresholds for one trade. This is the ONLY source of truth for
 * risk — the risk engine reads these; Pat/Willa may interpret the result but
 * must never invent or change a number here. Loaded from the job_type_rules
 * table (seeded by migration 20260608_weather_planning.sql).
 */
export interface RiskThresholds {
  rain_mm_per_hour?: RiskBand;
  precip_probability?: RiskBand;
  wind_kmh?: RiskBand;
  gust_kmh?: RiskBand;
  temperature_c?: TempBand;
  humidity_percent?: RiskBand;
  lightning_or_storm?: boolean;
  flood_alert?: boolean;
}

export interface JobTypeRule {
  job_type: string;
  display_name: string;
  outdoor: boolean;
  risk_thresholds: RiskThresholds;
  default_actions: { medium?: string[]; high?: string[] };
}

/** One hour of normalised forecast inside the job window. */
export interface ForecastHour {
  time: string; // ISO 8601 with offset
  precip_probability: number | null;
  rain_mm: number | null; // mm in that hour
  wind_kmh: number | null;
  gust_kmh: number | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  weather_code: string | null; // normalised label e.g. "rain", "thunderstorm"
  lightning_or_storm: boolean | null;
}

export interface WeatherAlert {
  type: string; // e.g. "thunderstorm", "strong_wind", "flood"
  severity: string; // "minor" | "moderate" | "severe"
  headline: string;
}

/** Provider output for one job window. Stored verbatim for audit. */
export interface ForecastSnapshot {
  provider: string;
  generated_at: string;
  job_id: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  window: { start: string; end: string };
  hourly: ForecastHour[];
  alerts: WeatherAlert[];
}

/** One threshold breach, with the observed value, the rule, and when. */
export interface TriggerFired {
  rule: string; // e.g. "rain_mm_per_hour.high"
  observed: number | boolean;
  threshold: number | boolean;
  window_time: string; // ISO hour, or window start for alert-based triggers
  risk: Exclude<RiskLevel, "low">; // which band fired (medium | high)
}

export type RecommendedAction =
  | "proceed"
  | "proceed_with_caution"
  | "move_earlier_or_reschedule"
  | "reschedule_or_swap";

/** Deterministic verdict. risk_level/flags come ONLY from the engine. */
export interface WeatherAssessment {
  job_id: string;
  job_type: string;
  provider: string;
  generated_at: string;
  window: { start: string; end: string };
  risk_level: RiskLevel;
  risk_types: string[]; // e.g. ["rain","wind"]
  triggers_fired: TriggerFired[];
  summary: string;
  recommended_action: RecommendedAction;
  customer_comms_needed: boolean;
  pat_should_run: boolean;
  willa_should_run: boolean;
}

/** The "job" we plan around — a scheduled quote plus its site context. */
export interface JobPayload {
  job_id: string;
  title: string;
  job_type: string;
  indoor_outdoor: "indoor" | "outdoor" | "mixed";
  site_address?: string | null;
  location: { lat: number; lon: number };
  timezone?: string | null;
  scheduled_start: string;
  scheduled_end: string;
  customer_contact?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

/** Pat's structured output (field-planning interpretation only). */
export interface PatOutput {
  risk_headline: string;
  why_it_matters: string;
  recommended_action: string;
  alternate_option: string;
  crew_note: string;
  confidence: string;
}

/** Willa's structured output (customer comms draft only; review required). */
export interface WillaOutput {
  should_contact_customer: boolean;
  reason: string;
  suggested_channel: "sms" | "email" | "none";
  customer_message: string;
  internal_note: string;
  confidence: string;
}

export interface CompanyContext {
  business_name: string;
  service_area: string;
  tone: string;
}

export interface AlternateJob {
  job_id: string;
  title: string;
  job_type: string;
  scheduled_start: string;
}
