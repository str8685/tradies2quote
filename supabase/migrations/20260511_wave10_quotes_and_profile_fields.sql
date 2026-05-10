-- Wave 10 — additive only. Nullable columns + partial indexes.
--
-- Adds three optional columns and two partial indexes used by the new
-- editable Settings form and the dashboard quote-management feature
-- (search / filter / archive / restore / soft-delete + Load more pagination).
--
-- Why this is safe:
--   * Every column is NULL by default. Existing rows are not touched.
--   * No backfill, no enum change, no extension change.
--   * Existing RLS policies on `profiles` and `quotes` already gate
--     reads/writes by `auth.uid()`. The new columns inherit those policies
--     without any policy edits — soft-delete and archive happen via the
--     existing `quotes_update_own` policy.
--   * Indexes are partial — they ignore rows whose flag column is null,
--     so the index stays small as the dataset grows.
--
-- To revert: drop the three columns and the two indexes.

alter table public.profiles
  add column if not exists gst_number text;

alter table public.quotes
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at  timestamptz;

create index if not exists quotes_user_active_created_at_idx
  on public.quotes (user_id, created_at desc)
  where deleted_at is null;

create index if not exists quotes_user_archived_at_idx
  on public.quotes (user_id, archived_at)
  where archived_at is not null;

comment on column public.profiles.gst_number is
  'Optional GST/tax registration number shown on issued quotes and invoices.';
comment on column public.quotes.archived_at is
  'Set when the user archives a finished quote. NULL means active.';
comment on column public.quotes.deleted_at is
  'Set when the user soft-deletes a quote. NULL means visible. Hard delete remains possible via RLS but the UI never uses it.';
