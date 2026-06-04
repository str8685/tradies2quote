-- ── beta_feedback: in-app beta feedback from tradies ────────────────────────
-- Additive, RLS-scoped to the submitting user. User-written (insert own),
-- user-readable (select own). No deletes/updates exposed.
create table if not exists public.beta_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  what_worked     text,
  what_confusing  text,
  wrong_number    text,
  would_pay       text,
  app_version     text,
  created_at      timestamptz not null default now()
);
create index if not exists beta_feedback_user_id_idx on public.beta_feedback (user_id);
create index if not exists beta_feedback_created_at_idx on public.beta_feedback (created_at desc);

alter table public.beta_feedback enable row level security;

drop policy if exists beta_feedback_insert_own on public.beta_feedback;
create policy beta_feedback_insert_own on public.beta_feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists beta_feedback_select_own on public.beta_feedback;
create policy beta_feedback_select_own on public.beta_feedback
  for select using (auth.uid() = user_id);
