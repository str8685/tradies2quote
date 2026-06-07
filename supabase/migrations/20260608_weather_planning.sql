-- ── Weather-Aware Job Planning ─────────────────────────────────────────────
-- Backs the weather → deterministic risk engine → Pat (field planning) →
-- Willa (customer comms drafts) → Workboard "Site conditions" flow.
-- See docs/weather-planning.md.
--
-- Additive only. Seven tables. Owner-scoped tables use the `(select auth.uid())`
-- RLS form (evaluated once per query, matching the Wave-40 initplan
-- optimisation). Two are non-sensitive shared CACHES (forecast/alerts) that any
-- authenticated user may read but only the service role writes. One reference
-- table (job_type_rules) holds the deterministic thresholds — the ONLY source
-- of truth for risk; the LLM never sets these.
--
-- "Jobs" are scheduled quotes (quotes.status='scheduled', quotes.scheduled_for).
-- quote_site_context fills the gap the quotes table has no column for: the
-- planning location (lat/lon), job_type, indoor/outdoor and timezone per job.
--
-- NOTE: NOT applied automatically. Owner approves the live apply (per CLAUDE.md
-- "ask before destructive/migrations"). Creating tables is additive; we still
-- gate it. After apply, regenerate database.types.ts.

-- ── job_type_rules: deterministic risk thresholds per trade ────────────────
-- SOURCE OF TRUTH for all weather risk. The risk engine reads thresholds from
-- here; Pat/Willa may interpret but must never invent or change them. Seeded as
-- system rules (is_system=true) and shared read-only with all authenticated
-- users; only migrations / service role write them.
create table if not exists public.job_type_rules (
  job_type         text primary key,
  display_name     text not null,
  outdoor          boolean not null default true,
  risk_thresholds  jsonb not null,
  default_actions  jsonb not null default '{}'::jsonb,
  is_system        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.job_type_rules enable row level security;

-- Reference data: any signed-in user may read the rules; nobody edits via RLS
-- (seeded by this migration; service role can amend).
drop policy if exists job_type_rules_select_all on public.job_type_rules;
create policy job_type_rules_select_all
  on public.job_type_rules for select to authenticated using (true);

-- ── weather_forecasts_cache: shared hourly forecast cache by location ──────
-- Non-sensitive. Keyed by rounded location + window so multiple jobs at one
-- site share a fetch. Service-role writes (orchestrator/cron); authenticated
-- reads. No insert/update policy → normal users cannot write it.
create table if not exists public.weather_forecasts_cache (
  id            uuid primary key default gen_random_uuid(),
  location_key  text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  provider      text not null default 'open_meteo',
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  generated_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  hourly        jsonb not null default '[]'::jsonb,
  alerts        jsonb not null default '[]'::jsonb
);

create index if not exists weather_forecasts_cache_key_idx
  on public.weather_forecasts_cache (location_key, window_start);
create index if not exists weather_forecasts_cache_expires_idx
  on public.weather_forecasts_cache (expires_at);

alter table public.weather_forecasts_cache enable row level security;
drop policy if exists weather_forecasts_cache_select_all on public.weather_forecasts_cache;
create policy weather_forecasts_cache_select_all
  on public.weather_forecasts_cache for select to authenticated using (true);

-- ── weather_alerts_cache: shared severe-weather alerts cache by location ───
create table if not exists public.weather_alerts_cache (
  id            uuid primary key default gen_random_uuid(),
  location_key  text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  provider      text not null default 'open_meteo',
  generated_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  alerts        jsonb not null default '[]'::jsonb
);

create index if not exists weather_alerts_cache_key_idx
  on public.weather_alerts_cache (location_key);
create index if not exists weather_alerts_cache_expires_idx
  on public.weather_alerts_cache (expires_at);

alter table public.weather_alerts_cache enable row level security;
drop policy if exists weather_alerts_cache_select_all on public.weather_alerts_cache;
create policy weather_alerts_cache_select_all
  on public.weather_alerts_cache for select to authenticated using (true);

-- ── quote_site_context: planning location + job type per scheduled quote ───
-- Owner-scoped. One row per quote (the "job"). lat/lon geocoded from the
-- client address; job_type maps to job_type_rules.
create table if not exists public.quote_site_context (
  quote_id          uuid primary key references public.quotes (id) on delete cascade,
  user_id           uuid not null,
  job_type          text,
  indoor_outdoor    text not null default 'outdoor',
  latitude          double precision,
  longitude         double precision,
  geocoded_address  text,
  timezone          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint quote_site_context_indoor_outdoor_chk
    check (indoor_outdoor in ('indoor','outdoor','mixed'))
);

create index if not exists quote_site_context_user_idx
  on public.quote_site_context (user_id);

alter table public.quote_site_context enable row level security;
drop policy if exists quote_site_context_select_own on public.quote_site_context;
create policy quote_site_context_select_own
  on public.quote_site_context for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists quote_site_context_insert_own on public.quote_site_context;
create policy quote_site_context_insert_own
  on public.quote_site_context for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists quote_site_context_update_own on public.quote_site_context;
create policy quote_site_context_update_own
  on public.quote_site_context for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── job_weather_assessments: deterministic risk verdict per job ────────────
-- Owner-scoped, auditable. Stores the exact triggers_fired + the forecast
-- snapshot used, so every verdict is reproducible. risk_level / recommended
-- flags come ONLY from the risk engine, never from an LLM.
create table if not exists public.job_weather_assessments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  quote_id              uuid not null references public.quotes (id) on delete cascade,
  job_type              text,
  provider              text not null default 'open_meteo',
  generated_at          timestamptz not null default now(),
  window_start          timestamptz,
  window_end            timestamptz,
  risk_level            text not null default 'low',
  risk_types            jsonb not null default '[]'::jsonb,
  triggers_fired        jsonb not null default '[]'::jsonb,
  summary               text,
  recommended_action    text,
  customer_comms_needed  boolean not null default false,
  pat_should_run        boolean not null default false,
  willa_should_run      boolean not null default false,
  forecast_snapshot     jsonb,
  trigger_source        text not null default 'manual',
  created_at            timestamptz not null default now(),
  constraint job_weather_assessments_risk_level_chk
    check (risk_level in ('low','medium','high')),
  constraint job_weather_assessments_trigger_source_chk
    check (trigger_source in ('on_change','evening','morning','prejob','manual'))
);

create index if not exists job_weather_assessments_user_idx
  on public.job_weather_assessments (user_id);
create index if not exists job_weather_assessments_quote_idx
  on public.job_weather_assessments (quote_id, generated_at desc);

alter table public.job_weather_assessments enable row level security;
drop policy if exists job_weather_assessments_select_own on public.job_weather_assessments;
create policy job_weather_assessments_select_own
  on public.job_weather_assessments for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists job_weather_assessments_insert_own on public.job_weather_assessments;
create policy job_weather_assessments_insert_own
  on public.job_weather_assessments for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ── ai_recommendations: Pat (and future) operational outputs ───────────────
-- Owner-scoped. Stores the generated output verbatim for audit.
create table if not exists public.ai_recommendations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  quote_id       uuid not null references public.quotes (id) on delete cascade,
  assessment_id  uuid references public.job_weather_assessments (id) on delete cascade,
  agent          text not null default 'pat',
  output         jsonb not null,
  model          text,
  created_at     timestamptz not null default now(),
  constraint ai_recommendations_agent_chk check (agent in ('pat'))
);

create index if not exists ai_recommendations_user_idx
  on public.ai_recommendations (user_id);
create index if not exists ai_recommendations_quote_idx
  on public.ai_recommendations (quote_id, created_at desc);

alter table public.ai_recommendations enable row level security;
drop policy if exists ai_recommendations_select_own on public.ai_recommendations;
create policy ai_recommendations_select_own
  on public.ai_recommendations for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists ai_recommendations_insert_own on public.ai_recommendations;
create policy ai_recommendations_insert_own
  on public.ai_recommendations for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ── customer_message_drafts: Willa outputs — REVIEW REQUIRED, never auto-sent
-- Owner-scoped. status defaults to 'draft'; nothing in this system flips it to
-- 'sent' automatically. Sending stays a deliberate, separate user action.
create table if not exists public.customer_message_drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  quote_id       uuid not null references public.quotes (id) on delete cascade,
  assessment_id  uuid references public.job_weather_assessments (id) on delete cascade,
  channel        text not null default 'none',
  message        text,
  internal_note  text,
  reason         text,
  confidence     text,
  status         text not null default 'draft',
  model          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint customer_message_drafts_channel_chk check (channel in ('sms','email','none')),
  constraint customer_message_drafts_status_chk
    check (status in ('draft','approved','dismissed','sent'))
);

create index if not exists customer_message_drafts_user_idx
  on public.customer_message_drafts (user_id);
create index if not exists customer_message_drafts_quote_idx
  on public.customer_message_drafts (quote_id, created_at desc);

alter table public.customer_message_drafts enable row level security;
drop policy if exists customer_message_drafts_select_own on public.customer_message_drafts;
create policy customer_message_drafts_select_own
  on public.customer_message_drafts for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists customer_message_drafts_insert_own on public.customer_message_drafts;
create policy customer_message_drafts_insert_own
  on public.customer_message_drafts for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists customer_message_drafts_update_own on public.customer_message_drafts;
create policy customer_message_drafts_update_own
  on public.customer_message_drafts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── Seed: 10 starter job-type rules ────────────────────────────────────────
-- Thresholds are taken verbatim from the product spec. ON CONFLICT DO UPDATE so
-- re-running this migration re-seeds the canonical thresholds (idempotent).
-- default_actions follow the spec's medium/high template.
insert into public.job_type_rules (job_type, display_name, outdoor, risk_thresholds, default_actions)
values
  ('roofing', 'Roofing', true, '{
    "rain_mm_per_hour": { "medium": 0.2, "high": 0.8 },
    "wind_kmh": { "medium": 20, "high": 30 },
    "gust_kmh": { "medium": 30, "high": 45 },
    "lightning_or_storm": true
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('exterior_painting', 'Exterior painting', true, '{
    "rain_mm_per_hour": { "medium": 0.1, "high": 0.5 },
    "precip_probability": { "medium": 40, "high": 60 },
    "temperature_c": { "low_min": 10, "high_max": 30 },
    "humidity_percent": { "medium": 80, "high": 90 }
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('fencing', 'Fencing', true, '{
    "rain_mm_per_hour": { "medium": 0.5, "high": 1.5 },
    "wind_kmh": { "medium": 25, "high": 40 },
    "gust_kmh": { "medium": 35, "high": 55 }
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('decking', 'Decking / exterior carpentry', true, '{
    "rain_mm_per_hour": { "medium": 0.5, "high": 1.5 },
    "wind_kmh": { "medium": 25, "high": 40 },
    "gust_kmh": { "medium": 35, "high": 55 }
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('concrete', 'Concrete / slab', true, '{
    "rain_mm_per_hour": { "medium": 0.2, "high": 1.0 },
    "temperature_c": { "low_min": 5, "high_max": 28 }
  }'::jsonb, '{
    "medium": ["review schedule", "move earlier in the day", "warn crew"],
    "high": ["move earlier or reschedule", "protect the pour", "prepare customer message"]
  }'::jsonb),
  ('excavation', 'Excavation / earthworks', true, '{
    "rain_mm_per_hour": { "medium": 1.0, "high": 3.0 },
    "precip_probability": { "medium": 60, "high": 80 }
  }'::jsonb, '{
    "medium": ["review schedule", "check ground conditions", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('landscaping', 'Landscaping', true, '{
    "rain_mm_per_hour": { "medium": 0.8, "high": 2.0 },
    "temperature_c": { "low_min": 2, "high_max": 32 }
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('solar_install', 'Solar install', true, '{
    "rain_mm_per_hour": { "medium": 0.2, "high": 0.8 },
    "wind_kmh": { "medium": 20, "high": 30 },
    "gust_kmh": { "medium": 30, "high": 45 },
    "lightning_or_storm": true
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb),
  ('plumbing_service', 'Plumbing service', false, '{
    "flood_alert": true,
    "lightning_or_storm": true
  }'::jsonb, '{
    "medium": ["review schedule", "warn crew"],
    "high": ["recommend reschedule", "prepare customer message"]
  }'::jsonb),
  ('electrical_outdoor', 'Outdoor electrical', true, '{
    "rain_mm_per_hour": { "medium": 0.1, "high": 0.5 },
    "lightning_or_storm": true,
    "wind_kmh": { "medium": 20, "high": 30 }
  }'::jsonb, '{
    "medium": ["review schedule", "prepare alternate indoor work", "warn crew"],
    "high": ["recommend reschedule", "offer job swap", "prepare customer message"]
  }'::jsonb)
on conflict (job_type) do update set
  display_name = excluded.display_name,
  outdoor = excluded.outdoor,
  risk_thresholds = excluded.risk_thresholds,
  default_actions = excluded.default_actions,
  updated_at = now();
