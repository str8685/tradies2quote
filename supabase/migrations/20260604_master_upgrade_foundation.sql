-- Master Upgrade — Chunk A: additive data foundation for four bolt-on features
--   1. Deposit-on-accept payments      → payment_accounts, payments
--   2. Kit / assembly bundles          → kits, kit_items
--   3. Auto review requests            → review_requests
--   4. Auto quote follow-ups           → quote_followups
--   + per-user feature toggles         → feature_settings
--
-- SAFETY (why this cannot break anything that already works):
--   * 100% ADDITIVE + IDEMPOTENT. Only CREATE TABLE/INDEX IF NOT EXISTS and
--     DROP POLICY IF EXISTS → CREATE POLICY. There is NO ALTER/DROP/DELETE on
--     any existing table. FKs to quotes(id) are read-only references. Running
--     this against the live DB cannot touch or lose any existing row.
--   * RLS enabled on every new table.
--       - User-owned tables (feature_settings, kits, kit_items) → full CRUD
--         scoped to auth.uid() = user_id.
--       - Server-written ledgers (payment_accounts, payments, review_requests,
--         quote_followups) → SELECT-own only. All writes go through the
--         service-role server client (bypasses RLS), so a client can never
--         forge a payment / review / follow-up row.
--   * No destructive operations anywhere (honors the project's no-destructive rule).

-- ── feature_settings: per-user toggles + Google review link ────────────────
create table if not exists public.feature_settings (
  user_id               uuid primary key,
  google_review_url     text,
  auto_review_enabled   boolean not null default false,
  auto_followup_enabled boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.feature_settings enable row level security;
drop policy if exists feature_settings_select_own on public.feature_settings;
create policy feature_settings_select_own on public.feature_settings
  for select using (auth.uid() = user_id);
drop policy if exists feature_settings_insert_own on public.feature_settings;
create policy feature_settings_insert_own on public.feature_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists feature_settings_update_own on public.feature_settings;
create policy feature_settings_update_own on public.feature_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── kits + kit_items: saved assemblies ("standard hot-water install") ───────
create table if not exists public.kits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  name       text not null,
  trade      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kits_user_id_idx on public.kits (user_id);
alter table public.kits enable row level security;
drop policy if exists kits_all_own on public.kits;
create policy kits_all_own on public.kits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.kit_items (
  id          uuid primary key default gen_random_uuid(),
  kit_id      uuid not null references public.kits (id) on delete cascade,
  user_id     uuid not null,
  type        text not null default 'material', -- material | labour | other
  description text not null,
  quantity    numeric not null default 1,
  unit        text,
  unit_price  numeric not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists kit_items_kit_id_idx on public.kit_items (kit_id);
create index if not exists kit_items_user_id_idx on public.kit_items (user_id);
alter table public.kit_items enable row level security;
drop policy if exists kit_items_all_own on public.kit_items;
create policy kit_items_all_own on public.kit_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── payment_accounts: each tradie's connected Stripe (Connect) account ──────
create table if not exists public.payment_accounts (
  user_id           uuid primary key,
  stripe_account_id text not null,
  charges_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  deposit_pct       integer not null default 50,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.payment_accounts enable row level security;
drop policy if exists payment_accounts_select_own on public.payment_accounts;
create policy payment_accounts_select_own on public.payment_accounts
  for select using (auth.uid() = user_id);

-- ── payments: client deposit payments (server/service-role written) ─────────
create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  quote_id                  uuid references public.quotes (id) on delete set null,
  amount_cents              integer not null,
  currency                  text not null,
  status                    text not null default 'pending', -- pending | paid | failed
  stripe_payment_intent_id  text,
  stripe_checkout_session_id text,
  created_at                timestamptz not null default now(),
  paid_at                   timestamptz
);
create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_quote_id_idx on public.payments (quote_id);
alter table public.payments enable row level security;
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select using (auth.uid() = user_id);

-- ── review_requests: one-per-quote dedup ledger (service-role written) ──────
create table if not exists public.review_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  channel    text not null default 'email', -- email | sms
  status     text not null default 'sent',
  sent_at    timestamptz not null default now(),
  unique (quote_id)
);
create index if not exists review_requests_user_id_idx on public.review_requests (user_id);
alter table public.review_requests enable row level security;
drop policy if exists review_requests_select_own on public.review_requests;
create policy review_requests_select_own on public.review_requests
  for select using (auth.uid() = user_id);

-- ── quote_followups: per-step dedup ledger (service-role written) ───────────
create table if not exists public.quote_followups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  step       integer not null,              -- 1 = day 2 nudge, 2 = day 5 nudge
  channel    text not null default 'email', -- email | sms
  sent_at    timestamptz not null default now(),
  unique (quote_id, step)
);
create index if not exists quote_followups_user_id_idx on public.quote_followups (user_id);
alter table public.quote_followups enable row level security;
drop policy if exists quote_followups_select_own on public.quote_followups;
create policy quote_followups_select_own on public.quote_followups
  for select using (auth.uid() = user_id);
