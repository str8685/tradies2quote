# Weather-Aware Job Planning

First-version system where weather affects job planning (Pat) and customer
communication (Willa), surfaced inside the dashboard Workboard as "Site
conditions". Flag-gated (`T2Q_WEATHER_PLANNING` / `NEXT_PUBLIC_T2Q_WEATHER_PLANNING`),
default **off**.

## The flow (one path)

```
scheduled quote ("job")
  → quote_site_context        job_type + indoor/outdoor + lat/lon (geocoded once)
  → provider.ts               Open-Meteo hourly forecast for the job window  ← ONLY weather source
  → risk-engine.ts            deterministic verdict: triggers_fired, risk_level  ← ONLY place risk is decided
  → job_weather_assessments   stored verbatim (triggers + forecast snapshot) for audit
  → Pat (agents/pat.ts)       interprets impact → operational next step      (only if pat_should_run)
  → ai_recommendations        stored
  → Willa (agents/willa.ts)   drafts customer message                         (only if willa_should_run)
  → customer_message_drafts   status='draft' — NEVER auto-sent
```

`assessJob()` in `src/lib/weather-planning/assess.ts` is the single orchestrator,
used identically by the cron sweeps and the on-demand route.

## Where each hard rule is enforced (ownership)

| Concern | Single owner | Enforcement |
|---|---|---|
| **Weather source of truth** | `provider.ts` (Open-Meteo) | The LLM never fetches weather; it only ever receives the `ForecastSnapshot`/`WeatherAssessment`. |
| **Risk decision / thresholds** | `risk-engine.ts` + `job_type_rules` table | Thresholds come only from the rule row passed in. Risk is OR-combined (worst hour wins), never averaged. Pure + unit-tested. |
| **Field interpretation** | `agents/pat.ts` | System prompt forbids inventing weather or changing thresholds; Pat only interprets the assessment. |
| **Customer comms** | `agents/willa.ts` | Drafts only. `customer_message_drafts.status` defaults to `draft`; nothing in this system sets it to `sent`. |
| **Feature gate** | `flag.ts` | Whole feature off unless the env flag is `1`. |

## Tables (migration `20260608_weather_planning.sql`)

- `job_type_rules` — deterministic thresholds per trade (10 seeded). Shared read-only reference data.
- `weather_forecasts_cache`, `weather_alerts_cache` — non-sensitive shared caches (service-role write, authenticated read).
- `quote_site_context` — per-job job_type, indoor/outdoor, lat/lon, timezone (owner-scoped).
- `job_weather_assessments` — the deterministic verdict + `triggers_fired` + forecast snapshot (owner-scoped, auditable).
- `ai_recommendations` — Pat output, stored verbatim (owner-scoped).
- `customer_message_drafts` — Willa drafts; review required, never auto-sent (owner-scoped).

## Triggers

- **On create/update / manual** — `POST /api/weather-planning/assess` `{ quoteId }` (user-auth).
- **Evening** (`/api/cron/weather-evening`, `0 7 * * *` UTC) — tomorrow's jobs.
- **Morning** (`/api/cron/weather-morning`, `0 18 * * *` UTC) — today's jobs.
- **Pre-job** (`/api/cron/weather-prejob`, `0 */2 * * *` UTC) — jobs starting within ~3h.

Crons are gated by `CRON_SECRET` + the feature flag, run the same `assessJob`,
cap the batch, and keep a wall-clock budget under Vercel's 60s limit (leftover
jobs are picked up next run).

## Dashboard ownership (focused operator-home)

Weather is **not** a standalone dashboard feature card. It lives inside the
**Today** block on the home screen (`src/app/app/page.tsx`):

- `SiteConditions.tsx` (server, flag-gated) renders per scheduled job: title, risk
  level, short reason, Pat's recommendation, and a "Review Willa draft" button when
  a draft exists. It only reads stored data — it never computes risk or sends.
- `WillaDraftReview.tsx` (client) is a **read-only** review panel (Copy / Dismiss).
  v1 has no send wiring — the tradie sends from their own SMS/email.
- The home was simplified to lead with what needs attention now: the standalone
  **Weather Impact** card and the duplicate **Materials** / **Quote hub** action
  cards were removed (those destinations are in the bottom-nav tabs), and the KPI
  strip, lifecycle pipeline and month calendar were demoted into a collapsed
  "pipeline, metrics & calendar" panel.
- The mobile **shell contract** (`docs/mobile-shell-contract.md`) was not touched.

## v1 limitations (deliberate, documented)

- **Job model** — "jobs" are scheduled quotes; there is no separate jobs table.
- **Location** — geocoded best-effort from the client's free-text address (Open-Meteo
  place search). If nothing resolves, the job is **skipped** (`location_unknown`) — the
  system never fabricates a location.
- **Job type** — inferred from `quote_data.job_summary` when not set; unknown trades are
  **skipped** (`job_type_unknown`), to be set by the tradie in the Workboard. No guessed risk.
- **Alerts** — Open-Meteo's free tier has no severe-weather feed, so thunderstorm alerts are
  derived from weather codes and `flood_alert` rules only fire if a future provider supplies
  flood alerts. Swapping providers means editing only `provider.ts`.
- **Window** — built from `scheduled_for`; a date-only (midnight) job is assumed to be a
  07:00–17:00 working block. Giving a job a start time sharpens the forecast window.

## Verification

- Deterministic engine: `src/lib/weather-planning/risk-engine.test.ts` — covers the three
  product scenarios (roofing high-wind → HIGH/reschedule/Willa; plumbing light-rain →
  LOW/proceed/no-Willa; concrete heavy-rain → HIGH/move-earlier/Willa) plus OR-combine,
  lightning, flood-alert, and audit-trail boundaries.
- Agents (Pat/Willa) run through the shared `runStructuredAgent` runtime (forced JSON,
  one retry, observability) — same as every other agent.
