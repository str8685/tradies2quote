-- Wave 39 — trial-anchor decoupling from auth.users.created_at.
--
-- Previously the 7-day trial was anchored to `auth.users.created_at`,
-- which is immutable. That meant any user who signed up >7 days ago
-- was permanently locked out the moment BETA_FREE_UNTIL expired —
-- with no way to give them a fresh trial short of deleting and
-- recreating their auth row.
--
-- This migration adds a nullable `trial_started_at` column on
-- `profiles`. When set, the subscription module uses it as the trial
-- anchor instead of auth.users.created_at. When null, it falls back
-- to auth.users.created_at and the original behaviour is preserved.
--
-- Why this is safe:
--   * Column is nullable with no default — existing rows are untouched.
--   * RLS policies on `profiles` are unchanged.
--   * The fallback in src/lib/subscription.ts means users without a
--     row in profiles (rare — only freshly signed-up accounts that
--     haven't visited Settings yet) keep working exactly as before.
--   * No new index needed — every subscription read is already keyed
--     by `profiles.id` (=user_id), which is the primary key.
--
-- To restart trials for every existing user (the "give them all a
-- fresh 7 days" action), run the companion one-shot script at
-- `supabase/scripts/restart_all_trials.sql` after this migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.trial_started_at IS
  'Overrides auth.users.created_at as the trial-anchor for subscription state. NULL = fall back to auth created_at. Set via supabase/scripts/restart_all_trials.sql for a bulk reset.';
