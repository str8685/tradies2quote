-- ── internal error monitoring (v1) ─────────────────────────────────────────
-- REVIEW-ONLY. This migration is written but NOT applied. Apply deliberately.
--
-- Self-hosted, owner-only error inbox that replaces paid error tracking. Two
-- tables, classic group+event split: one GROUP per unique error fingerprint
-- (the dashboard inbox), many EVENTS per group (the occurrence drilldown).
--
-- ACCESS POSTURE (intentional):
--   - RLS is ENABLED with NO policies → default-deny for `anon` and
--     `authenticated`. Regular app sessions can neither read nor write these
--     tables.
--   - The ONLY writer/reader is the service role (`adminClient()`), used
--     server-side. The service role bypasses RLS by design.
--   - Owner-only visibility is enforced in APP CODE (the dashboard server
--     component gates with `isOwnerEmail` before reading via the admin client).
--   - We also `revoke` table privileges from anon/authenticated as
--     defense-in-depth, so a missing policy can never accidentally expose rows.
--
-- PRIVACY (intentional): NO customer/quote/request-body data is stored. Only
-- the failure shape (surface, route, error name/message/stack, env, release).
-- Messages/stacks are truncated + scrubbed in app code before insert; the
-- schema deliberately has no column for user identity, client emails, request
-- bodies, or quote contents.
-- ────────────────────────────────────────────────────────────────────────────

-- ── Groups: one row per unique error fingerprint (the inbox) ────────────────
create table if not exists public.app_error_groups (
  id                uuid primary key default gen_random_uuid(),
  -- Dedupe key: sha256(surface|route|name|normalized_message|top_frame),
  -- computed in app code. Unique → upsert-on-conflict bumps the group.
  fingerprint       text not null unique,
  title             text not null,
  -- Where the failure originated.
  surface           text not null
                      check (surface in ('api', 'client', 'server_action')),
  -- e.g. 'quotes/generate', '/quote/[token]', 'saveQuoteChanges'. Nullable
  -- because a client global error may not map to a route.
  route             text,
  environment       text not null
                      check (environment in ('production', 'preview', 'development')),
  status            text not null default 'open'
                      check (status in ('open', 'resolved', 'ignored')),
  event_count       integer not null default 0,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  -- Commit SHA of the MOST RECENT occurrence (drives "still happening on the
  -- latest deploy?"). Per-occurrence release also lives on each event.
  last_release_sha  text,
  -- Commit SHA where this group FIRST appeared — set once at group creation.
  -- Gives one-glance "first appeared in release X" regression visibility.
  first_release_sha text,
  -- Representative top app stack frame (part of the fingerprint), surfaced
  -- directly in the inbox so triage doesn't need an event join.
  top_stack_frame   text,
  resolved_at       timestamptz,
  -- Coarse/stable owner identifier of who resolved it (v1: a literal 'owner'
  -- value). Deliberately NOT an email / account id — keeps PII out of the
  -- error store entirely.
  resolved_by       text
);

comment on table public.app_error_groups is
  'Internal error inbox: one row per unique error fingerprint. Owner-only via app gate; written by service role only. No customer/PII data.';

-- Primary inbox query: open groups, newest first.
create index if not exists app_error_groups_inbox_idx
  on public.app_error_groups (status, last_seen_at desc);
-- Sort across all statuses by recency.
create index if not exists app_error_groups_last_seen_idx
  on public.app_error_groups (last_seen_at desc);
-- Filter facets.
create index if not exists app_error_groups_environment_idx
  on public.app_error_groups (environment);
create index if not exists app_error_groups_surface_idx
  on public.app_error_groups (surface);
-- (fingerprint already has a unique index from the UNIQUE constraint above.)

alter table public.app_error_groups enable row level security;
-- No policies on purpose: default-deny for anon/authenticated. Service role
-- (adminClient) bypasses RLS and is the sole reader/writer.
revoke all on public.app_error_groups from anon, authenticated;


-- ── Events: individual occurrences (capped retention via a cron later) ──────
create table if not exists public.app_error_events (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null
                  references public.app_error_groups (id) on delete cascade,
  -- Denormalized so a fingerprint drilldown needs no join.
  fingerprint   text not null,
  name          text,           -- error class, e.g. 'TypeError'
  message       text,           -- truncated + scrubbed in app (~500 chars)
  stack         text,           -- truncated + scrubbed in app (~4 KB)
  surface       text not null
                  check (surface in ('api', 'client', 'server_action')),
  route         text,
  environment   text not null
                  check (environment in ('production', 'preview', 'development')),
  release_sha   text,           -- commit SHA of THIS occurrence
  http_status   integer,        -- for api failures (e.g. 500/502)
  request_id    text,           -- Vercel x-vercel-id, to cross-ref function logs
  extra         jsonb,          -- small, PII-scrubbed context (<= ~2 KB in app)
  occurred_at   timestamptz not null default now()
);

comment on table public.app_error_events is
  'Internal error occurrences (drilldown for app_error_groups). Owner-only via app gate; service-role write only. No customer/PII data; message/stack truncated+scrubbed in app.';

-- Drilldown: a group''s occurrences, newest first.
create index if not exists app_error_events_group_occurred_idx
  on public.app_error_events (group_id, occurred_at desc);
-- Direct fingerprint queries.
create index if not exists app_error_events_fingerprint_idx
  on public.app_error_events (fingerprint);
-- Retention cron cleanup (delete events older than N days).
create index if not exists app_error_events_occurred_at_idx
  on public.app_error_events (occurred_at);

alter table public.app_error_events enable row level security;
-- Same posture as groups: default-deny, service-role only.
revoke all on public.app_error_events from anon, authenticated;


-- ── record_app_error: ATOMIC group-upsert + event-insert (the write path) ───
-- Called by the server sink (writeAppError) via the service-role client. Does
-- the ON CONFLICT DO UPDATE logic the JS client can't express:
--   - new fingerprint  → insert group (event_count 1, first_*/last_* = this),
--   - repeat fingerprint → increment count, bump last_seen/last_release_sha,
--     refresh title/top_frame, and REOPEN if it was 'resolved' (an 'ignored'
--     group stays muted). first_seen_at / first_release_sha are preserved.
-- Then inserts the event row. SECURITY DEFINER with a locked search_path;
-- execute is revoked from anon/authenticated (service role only).
create or replace function public.record_app_error(
  p_fingerprint     text,
  p_title           text,
  p_surface         text,
  p_route           text,
  p_environment     text,
  p_release_sha     text,
  p_top_stack_frame text,
  p_name            text,
  p_message         text,
  p_stack           text,
  p_http_status     integer,
  p_request_id      text,
  p_extra           jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  insert into public.app_error_groups (
    fingerprint, title, surface, route, environment, status,
    event_count, first_seen_at, last_seen_at,
    first_release_sha, last_release_sha, top_stack_frame
  ) values (
    p_fingerprint, p_title, p_surface, p_route, p_environment, 'open',
    1, now(), now(),
    p_release_sha, p_release_sha, p_top_stack_frame
  )
  on conflict (fingerprint) do update set
    event_count      = public.app_error_groups.event_count + 1,
    last_seen_at     = now(),
    last_release_sha = excluded.last_release_sha,
    top_stack_frame  = coalesce(excluded.top_stack_frame, public.app_error_groups.top_stack_frame),
    title            = excluded.title,
    status           = case when public.app_error_groups.status = 'resolved'
                            then 'open' else public.app_error_groups.status end,
    resolved_at      = case when public.app_error_groups.status = 'resolved'
                            then null else public.app_error_groups.resolved_at end,
    resolved_by      = case when public.app_error_groups.status = 'resolved'
                            then null else public.app_error_groups.resolved_by end
  returning id into v_group_id;

  insert into public.app_error_events (
    group_id, fingerprint, name, message, stack, surface, route,
    environment, release_sha, http_status, request_id, extra
  ) values (
    v_group_id, p_fingerprint, p_name, p_message, p_stack, p_surface, p_route,
    p_environment, p_release_sha, p_http_status, p_request_id, p_extra
  );
end;
$$;

-- Postgres auto-grants EXECUTE to PUBLIC on function creation, so revoking from
-- anon/authenticated alone leaves the RPC callable via the public anon key.
-- Revoke from PUBLIC and grant EXECUTE only to the service role (the sole caller
-- via adminClient()).
revoke all on function public.record_app_error(
  text, text, text, text, text, text, text, text, text, text, integer, text, jsonb
) from public;
grant execute on function public.record_app_error(
  text, text, text, text, text, text, text, text, text, text, integer, text, jsonb
) to service_role;
