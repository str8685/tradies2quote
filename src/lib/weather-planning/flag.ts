// ── Feature flag: Weather-Aware Job Planning ───────────────────────────────
// DEFAULT OFF. The whole feature (cron, on-demand assess, Workboard block) is
// gated here so it can ship dark and be switched on per environment. Set
// T2Q_WEATHER_PLANNING=1 (server) and/or NEXT_PUBLIC_T2Q_WEATHER_PLANNING=1
// (client/UI) to enable. Mirrors the REVIEWS_ENABLED / FOLLOWUPS_ENABLED pattern.

export function isWeatherPlanningEnabled(): boolean {
  return (
    process.env.T2Q_WEATHER_PLANNING === "1" ||
    process.env.NEXT_PUBLIC_T2Q_WEATHER_PLANNING === "1"
  );
}
