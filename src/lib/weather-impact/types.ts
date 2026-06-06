export type WeatherImpactStatus = "safe" | "caution" | "unsafe";

export type WeatherImpactTrade =
  | "roofing"
  | "painting_exterior"
  | "concrete_slab"
  | "framing_carpentry"
  | "scaffolding_height"
  | "earthworks_digging"
  | "brick_block_laying"
  | "cladding_exterior"
  | "general_outdoor";

export interface WeatherImpactContext {
  workingAtHeight: boolean;
  exposedSite: boolean;
  surfaceWet: boolean;
  usingLiftScaffoldLadder: boolean;
  pouringConcreteToday: boolean;
  exteriorFinishApplication: boolean;
}

export interface WeatherForecastWindow {
  startsAt: string;
  rainProbabilityPct: number | null;
  precipitationMmPerHour: number | null;
  windGustKph: number | null;
  thunderstormRisk: boolean | null;
  temperatureC: number | null;
}

export interface WeatherImpactInput {
  observedAt?: string | null;
  source?: string | null;
  summary?: string | null;
  rainProbabilityPct: number | null;
  precipitationMmPerHour: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  thunderstormRisk: boolean | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  visibilityKm: number | null;
  forecast?: WeatherForecastWindow[];
}

export interface TriggeredWeatherRule {
  id: string;
  status: Exclude<WeatherImpactStatus, "safe">;
  score: number;
  reason: string;
  controls: string[];
  blockedTasks: string[];
  safeTasks: string[];
}

export interface WeatherImpactResult {
  overall_status: WeatherImpactStatus;
  severity_score: number;
  confidence: "normal" | "degraded";
  reasons: string[];
  controls: string[];
  blocked_tasks: string[];
  safe_tasks: string[];
  weather_summary: string;
  next_better_window: string | null;
  missing_fields: string[];
  triggered_rules: TriggeredWeatherRule[];
  advisory: string;
}
