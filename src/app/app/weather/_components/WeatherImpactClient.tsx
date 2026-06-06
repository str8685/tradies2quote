"use client";

import { useMemo, useState } from "react";
import {
  ArrowClockwise,
  CloudSun,
  MapPin,
  ShieldCheck,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  DEFAULT_WEATHER_CONTEXT,
  TRADE_OPTIONS,
  evaluateWeatherImpact,
  fetchOpenMeteoWeather,
  type WeatherImpactContext,
  type WeatherImpactInput,
  type WeatherImpactStatus,
  type WeatherImpactTrade,
} from "@/lib/weather-impact";

const EMPTY_WEATHER: WeatherImpactInput = {
  rainProbabilityPct: null,
  precipitationMmPerHour: null,
  windSpeedKph: null,
  windGustKph: null,
  thunderstormRisk: null,
  temperatureC: null,
  feelsLikeC: null,
  humidityPct: null,
  visibilityKm: null,
  forecast: [],
};

const WEATHER_FIELDS: ReadonlyArray<{
  key: keyof Pick<
    WeatherImpactInput,
    | "rainProbabilityPct"
    | "precipitationMmPerHour"
    | "windSpeedKph"
    | "windGustKph"
    | "temperatureC"
    | "feelsLikeC"
    | "humidityPct"
    | "visibilityKm"
  >;
  label: string;
  suffix: string;
  step: string;
}> = [
  { key: "rainProbabilityPct", label: "Rain chance", suffix: "%", step: "1" },
  { key: "precipitationMmPerHour", label: "Rain intensity", suffix: "mm/h", step: "0.1" },
  { key: "windSpeedKph", label: "Wind", suffix: "kph", step: "1" },
  { key: "windGustKph", label: "Gusts", suffix: "kph", step: "1" },
  { key: "temperatureC", label: "Temp", suffix: "deg C", step: "0.5" },
  { key: "feelsLikeC", label: "Feels like", suffix: "deg C", step: "0.5" },
  { key: "humidityPct", label: "Humidity", suffix: "%", step: "1" },
  { key: "visibilityKm", label: "Visibility", suffix: "km", step: "0.5" },
];

const CONTEXT_TOGGLES: ReadonlyArray<{
  key: keyof WeatherImpactContext;
  label: string;
}> = [
  { key: "workingAtHeight", label: "Working at height" },
  { key: "exposedSite", label: "Exposed site" },
  { key: "surfaceWet", label: "Wet/slippery surface" },
  { key: "usingLiftScaffoldLadder", label: "Ladder, scaffold, or lift" },
  { key: "pouringConcreteToday", label: "Pouring concrete today" },
  { key: "exteriorFinishApplication", label: "Exterior finish / adhesive" },
];

export function WeatherImpactClient() {
  const [trade, setTrade] = useState<WeatherImpactTrade>("roofing");
  const [context, setContext] = useState<WeatherImpactContext>({
    ...DEFAULT_WEATHER_CONTEXT,
  });
  const [weather, setWeather] = useState<WeatherImpactInput>(EMPTY_WEATHER);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [fetchError, setFetchError] = useState<string | null>(null);

  const result = useMemo(
    () => evaluateWeatherImpact({ trade, weather, context }),
    [trade, weather, context],
  );
  const status = STATUS_COPY[result.overall_status];

  async function useCurrentWeather() {
    setFetchState("loading");
    setFetchError(null);
    try {
      const position = await getCurrentPosition();
      const nextWeather = await fetchOpenMeteoWeather({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setWeather(nextWeather);
      setFetchState("ready");
    } catch (error) {
      setFetchState("error");
      setFetchError(
        error instanceof Error
          ? error.message
          : "Could not load weather. You can still enter conditions manually.",
      );
    }
  }

  function updateWeatherNumber(
    key: (typeof WEATHER_FIELDS)[number]["key"],
    rawValue: string,
  ) {
    setWeather((current) => ({
      ...current,
      [key]: rawValue.trim() === "" ? null : Number(rawValue),
    }));
  }

  return (
    <div className="space-y-5">
      <section className={`t2q-card-pro overflow-hidden border ${status.shell}`}>
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span
            aria-hidden="true"
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${status.icon}`}
          >
            <status.Icon size={26} weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t2q-section-label-pro">{"// weather impact"}</p>
            <h2 className={`mt-2 text-3xl font-semibold sm:text-4xl ${status.text}`}>
              {status.label}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              {result.weather_summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge label={`Score ${result.severity_score}/100`} />
              <Badge
                label={
                  result.confidence === "degraded"
                    ? "Incomplete weather data"
                    : weather.source ?? "Manual conditions"
                }
              />
              {weather.observedAt ? <Badge label={`Observed ${formatObserved(weather.observedAt)}`} /> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="space-y-5">
          <section className="t2q-card-pro p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="t2q-section-label-pro">{"// setup"}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Trade and site</h3>
              </div>
              <CloudSun size={24} weight="bold" className="text-brand" aria-hidden="true" />
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-ink-300">Trade</span>
              <select
                value={trade}
                onChange={(event) => setTrade(event.target.value as WeatherImpactTrade)}
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-base font-semibold text-white"
              >
                {TRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid grid-cols-1 gap-2">
              {CONTEXT_TOGGLES.map((toggle) => {
                const checked = context[toggle.key];
                return (
                  <label
                    key={toggle.key}
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      checked
                        ? "border-brand/40 bg-brand/10 text-brand"
                        : "border-white/10 bg-white/[0.02] text-ink-300"
                    }`}
                  >
                    <span>{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setContext((current) => ({
                          ...current,
                          [toggle.key]: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-brand"
                    />
                  </label>
                );
              })}
            </div>
          </section>

          <section className="t2q-card-pro p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="t2q-section-label-pro">{"// current weather"}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Conditions</h3>
              </div>
              <button
                type="button"
                onClick={useCurrentWeather}
                disabled={fetchState === "loading"}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 text-sm font-semibold text-brand disabled:opacity-60"
              >
                {fetchState === "loading" ? (
                  <ArrowClockwise size={17} className="animate-spin" aria-hidden="true" />
                ) : (
                  <MapPin size={17} weight="bold" aria-hidden="true" />
                )}
                Use location
              </button>
            </div>
            {fetchError ? (
              <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                {fetchError}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {WEATHER_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="text-xs font-semibold text-ink-400">{field.label}</span>
                  <span className="mt-1 flex h-12 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={field.step}
                      value={weather[field.key] ?? ""}
                      onChange={(event) => updateWeatherNumber(field.key, event.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold text-white outline-none"
                    />
                    <span className="ml-2 text-xs font-semibold text-ink-400">
                      {field.suffix}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <label
              className={`mt-3 flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-semibold ${
                weather.thunderstormRisk
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-white/10 bg-white/[0.02] text-ink-300"
              }`}
            >
              <span>Lightning / thunderstorm risk</span>
              <input
                type="checkbox"
                checked={weather.thunderstormRisk === true}
                onChange={(event) =>
                  setWeather((current) => ({
                    ...current,
                    thunderstormRisk: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-brand"
              />
            </label>
          </section>
        </div>

        <div className="space-y-5">
          <ResultSection
            title="Why?"
            items={result.reasons}
            empty="No weather rule has fired yet."
          />
          <ResultSection
            title="Recommended actions"
            items={result.controls}
            empty="Keep monitoring conditions."
          />
          <section className="grid gap-5 sm:grid-cols-2">
            <ResultSection
              title="Blocked tasks"
              items={result.blocked_tasks}
              empty="No blocked tasks from weather rules."
            />
            <ResultSection
              title="Still useful"
              items={result.safe_tasks}
              empty="Add current conditions to see suggested safe tasks."
            />
          </section>
          <section className="t2q-card-pro p-5 sm:p-6">
            <p className="t2q-section-label-pro">{"// better window"}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">
              {result.next_better_window ??
                "No better 3-hour window found in the available forecast yet."}
            </p>
          </section>
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-ink-400">
            {result.advisory}
          </p>
        </div>
      </section>
    </div>
  );
}

function ResultSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="t2q-card-pro p-5 sm:p-6">
      <p className="t2q-section-label-pro">{`// ${title}`}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-ink-400">{empty}</p>
      )}
    </section>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-ink-300">
      {label}
    </span>
  );
}

const STATUS_COPY: Record<
  WeatherImpactStatus,
  {
    label: string;
    text: string;
    shell: string;
    icon: string;
    Icon: typeof ShieldCheck;
  }
> = {
  safe: {
    label: "Safe to work",
    text: "text-emerald-300",
    shell: "border-emerald-500/40 bg-emerald-500/10",
    icon: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    Icon: ShieldCheck,
  },
  caution: {
    label: "Use caution",
    text: "text-amber-300",
    shell: "border-amber-500/40 bg-amber-500/10",
    icon: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    Icon: Warning,
  },
  unsafe: {
    label: "Not safe to work",
    text: "text-red-300",
    shell: "border-red-500/40 bg-red-500/10",
    icon: "border-red-500/40 bg-red-500/10 text-red-300",
    Icon: XCircle,
  },
};

function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not available in this browser."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 12_000,
    });
  });
}

function formatObserved(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  });
}
