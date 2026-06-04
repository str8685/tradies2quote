-- Back-fill: agent-monitor + quote-event logging tables.
--
-- These three tables (agent_events, agent_runs, quote_events) already exist in
-- the live database and in database.types.ts, but had NO migration in the repo
-- — so a clean rebuild / fresh Supabase branch would break every agent-log and
-- quote-event write. This file records their schema as source-of-truth.
--
-- Safety:
--   * Fully ADDITIVE + IDEMPOTENT — CREATE ... IF NOT EXISTS / guarded enum.
--     Running it against the existing live DB touches nothing (the objects
--     already exist). It exists so a rebuild reproduces the schema.
--   * SERVICE-ROLE-ONLY access: all three are written/read exclusively via the
--     admin (service-role) client, which bypasses RLS. We ENABLE RLS with NO
--     policies — that is deny-all to anon + authenticated (fail-closed), the
--     intended posture. No user can read or write these directly.
--   * No DELETE anywhere — consistent with the project's no-destructive rule.

-- ── quote_event_type enum (guarded — almost certainly already exists) ──────
do $$
begin
  create type public.quote_event_type as enum (
    'sent', 'viewed', 'accepted', 'declined', 'expired',
    'scheduled', 'in_progress', 'completed', 'follow_up_sent', 'sms_sent'
  );
exception
  when duplicate_object then null;
end
$$;

-- ── agent_events: append-only event log (one row per logged step) ──────────
create table if not exists public.agent_events (
  id           uuid primary key default gen_random_uuid(),
  run_id       text,
  agent_name   text not null,
  event_type   text not null,
  status       text not null,
  step         text,
  message      text,
  quote_id     uuid,
  user_id      uuid,
  handoff_from text,
  handoff_to   text,
  progress_pct integer,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists agent_events_created_at_idx on public.agent_events (created_at desc);
create index if not exists agent_events_run_id_idx on public.agent_events (run_id);
create index if not exists agent_events_event_type_idx on public.agent_events (event_type);

-- ── agent_runs: run lifecycle (upserted on run.start, updated on run.finish) ─
create table if not exists public.agent_runs (
  id                uuid primary key default gen_random_uuid(),
  run_id            text not null unique,
  agent_name        text not null,
  status            text not null,
  approval_required boolean not null default false,
  last_step         text,
  last_message      text,
  error_message     text,
  quote_id          uuid,
  user_id           uuid,
  handoff_from      text,
  handoff_to        text,
  duration_ms       integer,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);
create index if not exists agent_runs_started_at_idx on public.agent_runs (started_at desc);
create index if not exists agent_runs_status_idx on public.agent_runs (status);

-- ── quote_events: lifecycle events for a quote (sent/viewed/accepted/…) ─────
create table if not exists public.quote_events (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  type       public.quote_event_type not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quote_events_quote_id_idx on public.quote_events (quote_id);
create index if not exists quote_events_created_at_idx on public.quote_events (created_at desc);

-- ── RLS: enable on all three, NO policies = service-role-only (fail-closed) ─
alter table public.agent_events enable row level security;
alter table public.agent_runs   enable row level security;
alter table public.quote_events enable row level security;
