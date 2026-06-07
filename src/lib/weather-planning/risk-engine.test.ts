import { describe, expect, it } from "vitest";
import { evaluateJobWeather } from "./risk-engine";
import { getRuleFallback } from "./rules";
import type { ForecastHour, ForecastSnapshot } from "./types";

const NOW = "2026-06-07T20:00:00+12:00";

function hour(time: string, over: Partial<ForecastHour>): ForecastHour {
  return {
    time,
    precip_probability: null,
    rain_mm: null,
    wind_kmh: null,
    gust_kmh: null,
    temperature_c: null,
    humidity_percent: null,
    weather_code: null,
    lightning_or_storm: null,
    ...over,
  };
}

function snapshot(hourly: ForecastHour[], alerts: ForecastSnapshot["alerts"] = []): ForecastSnapshot {
  return {
    provider: "open_meteo",
    generated_at: NOW,
    job_id: "job_test",
    latitude: -41.126,
    longitude: 175.07,
    timezone: "Pacific/Auckland",
    window: { start: "2026-06-08T08:00:00+12:00", end: "2026-06-08T15:00:00+12:00" },
    hourly,
    alerts,
  };
}

function rule(jobType: string) {
  const r = getRuleFallback(jobType);
  if (!r) throw new Error(`missing rule ${jobType}`);
  return r;
}

describe("evaluateJobWeather — required product scenarios", () => {
  it("scenario 1: roofing in high wind + light rain → HIGH, reschedule_or_swap, Willa runs", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0.3, wind_kmh: 34, gust_kmh: 48, temperature_c: 13 }),
      hour("2026-06-08T10:00:00+12:00", { rain_mm: 0.2, wind_kmh: 31, gust_kmh: 46, temperature_c: 13 }),
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("roofing"), forecast, now: NOW });

    expect(a.risk_level).toBe("high");
    expect(a.recommended_action).toBe("reschedule_or_swap");
    expect(a.customer_comms_needed).toBe(true);
    expect(a.willa_should_run).toBe(true);
    expect(a.pat_should_run).toBe(true);
    expect(a.risk_types).toContain("wind");
    // high wind threshold (30) fired
    expect(a.triggers_fired.some((t) => t.rule === "wind_kmh.high")).toBe(true);
  });

  it("scenario 2: plumbing_service in light rain only → LOW, proceed, Willa does not run", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0.4, precip_probability: 35, temperature_c: 12 }),
      hour("2026-06-08T10:00:00+12:00", { rain_mm: 0.2, precip_probability: 30, temperature_c: 12 }),
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("plumbing_service"), forecast, now: NOW });

    expect(a.risk_level).toBe("low");
    expect(a.recommended_action).toBe("proceed");
    expect(a.customer_comms_needed).toBe(false);
    expect(a.willa_should_run).toBe(false);
    expect(a.pat_should_run).toBe(false);
    expect(a.triggers_fired).toHaveLength(0);
  });

  it("scenario 3: concrete with heavy afternoon rain in the pour window → HIGH, move_earlier_or_reschedule, Willa runs", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0.1, temperature_c: 16 }),
      hour("2026-06-08T13:00:00+12:00", { rain_mm: 2.4, temperature_c: 15 }), // heavy
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("concrete"), forecast, now: NOW });

    expect(a.risk_level).toBe("high");
    expect(a.recommended_action).toBe("move_earlier_or_reschedule");
    expect(a.customer_comms_needed).toBe(true);
    expect(a.willa_should_run).toBe(true);
    const rainHigh = a.triggers_fired.find((t) => t.rule === "rain_mm_per_hour.high");
    expect(rainHigh?.observed).toBe(2.4);
    expect(rainHigh?.threshold).toBe(1.0);
    expect(rainHigh?.window_time).toBe("2026-06-08T13:00:00+12:00");
  });
});

describe("evaluateJobWeather — boundaries & OR-combine", () => {
  it("medium-only breach → MEDIUM, proceed_with_caution, Pat runs but Willa does not", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0.6, wind_kmh: 26 }), // decking medium bands
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("decking"), forecast, now: NOW });
    expect(a.risk_level).toBe("medium");
    expect(a.recommended_action).toBe("proceed_with_caution");
    expect(a.pat_should_run).toBe(true);
    expect(a.willa_should_run).toBe(false);
  });

  it("OR-combines worst hour, not average: one high hour among calm hours → HIGH", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0, wind_kmh: 5, gust_kmh: 10 }),
      hour("2026-06-08T10:00:00+12:00", { rain_mm: 0, wind_kmh: 5, gust_kmh: 10 }),
      hour("2026-06-08T11:00:00+12:00", { rain_mm: 2.0, wind_kmh: 5, gust_kmh: 10 }), // decking rain.high=1.5
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("decking"), forecast, now: NOW });
    expect(a.risk_level).toBe("high");
  });

  it("lightning anywhere in the window is HIGH for storm-sensitive trades", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0, lightning_or_storm: true, weather_code: "thunderstorm" }),
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("solar_install"), forecast, now: NOW });
    expect(a.risk_level).toBe("high");
    expect(a.risk_types).toContain("storm");
  });

  it("clear day → LOW with no triggers and an honest summary", () => {
    const forecast = snapshot([
      hour("2026-06-08T09:00:00+12:00", { rain_mm: 0, wind_kmh: 8, gust_kmh: 12, temperature_c: 18, precip_probability: 5 }),
    ]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("roofing"), forecast, now: NOW });
    expect(a.risk_level).toBe("low");
    expect(a.triggers_fired).toHaveLength(0);
    expect(a.summary.toLowerCase()).toContain("low weather risk");
  });

  it("plumbing flood alert → HIGH via alert, even with no per-hour breach", () => {
    const forecast = snapshot(
      [hour("2026-06-08T09:00:00+12:00", { rain_mm: 0.1 })],
      [{ type: "flood", severity: "moderate", headline: "Surface flooding watch" }],
    );
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("plumbing_service"), forecast, now: NOW });
    expect(a.risk_level).toBe("high");
    expect(a.risk_types).toContain("flood");
  });

  it("records observed vs threshold on every trigger (auditable)", () => {
    const forecast = snapshot([hour("2026-06-08T09:00:00+12:00", { gust_kmh: 60 })]);
    const a = evaluateJobWeather({ jobId: "job_test", rule: rule("fencing"), forecast, now: NOW });
    const gust = a.triggers_fired.find((t) => t.rule === "gust_kmh.high");
    expect(gust).toMatchObject({ observed: 60, threshold: 55, risk: "high" });
  });
});
