-- ── plan-reader Phase 1: file + sheet records ──────────────────────────────
-- Persists uploaded construction plans (PDF/PNG/JPG) and their per-page
-- sheets for the AI plan-reading + material-takeoff system
-- (see docs/plan-reader/ARCHITECTURE.md).
--
-- Additive only. Two tables, both RLS-scoped to the owning user. The
-- `(select auth.uid())` form is used (not bare auth.uid()) so the policy is
-- evaluated ONCE per query, not per row — matching the Wave-40 RLS initplan
-- optimization already applied to the rest of the schema.
--
-- NOTE: this migration is NOT applied automatically. The owner approves the
-- live apply (per CLAUDE.md "ask before destructive/migrations" and the
-- no-destructive-SQL policy). Creating tables is additive, but we still gate
-- it. After apply, regenerate database.types.ts so the typed Supabase client
-- knows the new tables, then build the ingest/classify routes.

-- ── plan_files: one row per uploaded file ──────────────────────────────────
create table if not exists public.plan_files (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  quote_id           uuid references public.quotes (id) on delete set null,
  project_id         text,
  original_filename  text not null,
  mime               text not null,
  byte_size          bigint not null,
  page_count         integer not null default 1,
  storage_path       text not null,
  status             text not null default 'uploaded',
  uploaded_at        timestamptz not null default now(),
  constraint plan_files_mime_chk
    check (mime in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  constraint plan_files_status_chk
    check (status in ('uploaded','classified','extracted','review','done','error')),
  constraint plan_files_page_count_chk
    check (page_count between 1 and 200)
);

create index if not exists plan_files_user_id_idx on public.plan_files (user_id);
create index if not exists plan_files_quote_id_idx on public.plan_files (quote_id);
create index if not exists plan_files_uploaded_at_idx on public.plan_files (uploaded_at desc);

-- ── plan_sheets: one row per page of a file ────────────────────────────────
create table if not exists public.plan_sheets (
  id                         uuid primary key default gen_random_uuid(),
  file_id                    uuid not null references public.plan_files (id) on delete cascade,
  user_id                    uuid not null,
  sheet_number               integer not null,
  sheet_label                text,
  image_path                 text not null,
  sheet_type                 text not null default 'unknown',
  classification_confidence  real not null default 0,
  classification_basis       jsonb not null default '[]'::jsonb,
  extraction                 jsonb,
  review_required            boolean not null default false,
  review_reasons             jsonb not null default '[]'::jsonb,
  status                     text not null default 'classified',
  created_at                 timestamptz not null default now(),
  constraint plan_sheets_sheet_type_chk
    check (sheet_type in ('deck','floor_plan','foundation','elevation','section_detail','schedule','unknown')),
  constraint plan_sheets_status_chk
    check (status in ('classified','extracting','extracted','needs_review','blocked','done')),
  constraint plan_sheets_confidence_chk
    check (classification_confidence between 0 and 1),
  constraint plan_sheets_number_chk
    check (sheet_number between 1 and 200),
  unique (file_id, sheet_number)
);

create index if not exists plan_sheets_file_id_idx on public.plan_sheets (file_id);
create index if not exists plan_sheets_user_id_idx on public.plan_sheets (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.plan_files enable row level security;
alter table public.plan_sheets enable row level security;

drop policy if exists plan_files_select_own on public.plan_files;
create policy plan_files_select_own on public.plan_files
  for select using ((select auth.uid()) = user_id);

drop policy if exists plan_files_insert_own on public.plan_files;
create policy plan_files_insert_own on public.plan_files
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists plan_files_update_own on public.plan_files;
create policy plan_files_update_own on public.plan_files
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists plan_sheets_select_own on public.plan_sheets;
create policy plan_sheets_select_own on public.plan_sheets
  for select using ((select auth.uid()) = user_id);

drop policy if exists plan_sheets_insert_own on public.plan_sheets;
create policy plan_sheets_insert_own on public.plan_sheets
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists plan_sheets_update_own on public.plan_sheets;
create policy plan_sheets_update_own on public.plan_sheets
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── Storage bucket ─────────────────────────────────────────────────────────
-- Private bucket for originals + rendered page PNGs. Objects are keyed by
-- "{user_id}/{file_id}/..." and access is via signed URLs only.
insert into storage.buckets (id, name, public)
values ('plan-uploads', 'plan-uploads', false)
on conflict (id) do nothing;

-- Storage RLS: a user may only touch objects under their own "{uid}/" prefix.
drop policy if exists plan_uploads_select_own on storage.objects;
create policy plan_uploads_select_own on storage.objects
  for select using (
    bucket_id = 'plan-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists plan_uploads_insert_own on storage.objects;
create policy plan_uploads_insert_own on storage.objects
  for insert with check (
    bucket_id = 'plan-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists plan_uploads_update_own on storage.objects;
create policy plan_uploads_update_own on storage.objects
  for update using (
    bucket_id = 'plan-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
