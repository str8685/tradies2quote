import { describe, expect, it } from "vitest";
import { evaluateWeatherImpact } from "./evaluate";
import type { WeatherImpactInput } from "./types";

const mildWeather: WeatherImpactInput = {
  rainProbabilityPct: 10,
  precipitationMmPerHour: 0,
  windSpeedKph: 10,
  windGustKph: 18,
  thunderstormRisk: false,
  temperatureC: 18,
  feelsLikeC: 18,
  humidityPct: 55,
  visibilityKm: 20,
};

describe("evaluateWeatherImpact", () => {
  it("marks roofing with strong gusts as unsafe", () => {
    const result = evaluateWeatherImpact({
      trade: "roofing",
      weather: { ...mildWeather, windGustKph: 52 },
    });

    expect(result.overall_status).toBe("unsafe");
    expect(result.blocked_tasks).toContain("Roof work");
  });

  it("marks roofing with lightning risk as unsafe", () => {
    const result = evaluateWeatherImpact({
      trade: "roofing",
      weather: { ...mildWeather, thunderstormRisk: true },
    });

    expect(result.overall_status).toBe("unsafe");
    expect(result.reasons.join(" ")).toMatch(/Lightning/i);
  });

  it("marks exterior painting with rain as unsafe", () => {
    const result = evaluateWeatherImpact({
      trade: "painting_exterior",
      weather: { ...mildWeather, rainProbabilityPct: 70, precipitationMmPerHour: 0.8 },
    });

    expect(result.overall_status).toBe("unsafe");
    expect(result.blocked_tasks).toContain("Exterior coating");
  });

  it("marks exterior painting with high humidity as caution", () => {
    const result = evaluateWeatherImpact({
      trade: "painting_exterior",
      weather: { ...mildWeather, humidityPct: 86 },
    });

    expect(result.overall_status).toBe("caution");
    expect(result.reasons.join(" ")).toMatch(/Humidity/i);
  });

  it("marks concrete with moderate rain as caution", () => {
    const result = evaluateWeatherImpact({
      trade: "concrete_slab",
      weather: { ...mildWeather, rainProbabilityPct: 45, precipitationMmPerHour: 0.8 },
    });

    expect(result.overall_status).toBe("caution");
    expect(result.controls.join(" ")).toMatch(/cover/i);
  });

  it("marks framing in mild conditions as safe", () => {
    const result = evaluateWeatherImpact({
      trade: "framing_carpentry",
      weather: mildWeather,
    });

    expect(result.overall_status).toBe("safe");
    expect(result.confidence).toBe("normal");
  });

  it("degrades missing weather data to caution instead of fake safe", () => {
    const result = evaluateWeatherImpact({
      trade: "general_outdoor",
      weather: { ...mildWeather, windGustKph: null, thunderstormRisk: null },
    });

    expect(result.overall_status).toBe("caution");
    expect(result.confidence).toBe("degraded");
    expect(result.missing_fields).toContain("windGustKph");
  });

  it("escalates optional ladder/scaffold use in gusty weather", () => {
    const result = evaluateWeatherImpact({
      trade: "general_outdoor",
      weather: { ...mildWeather, windGustKph: 42 },
      context: { usingLiftScaffoldLadder: true },
    });

    expect(result.overall_status).toBe("unsafe");
    expect(result.blocked_tasks).toContain("Ladder work");
  });
});
