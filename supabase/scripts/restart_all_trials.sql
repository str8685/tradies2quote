-- One-shot: restart everyone's 7-day trial from now.
--
-- Run this once after applying the migration in
-- supabase/migrations/20260519_trial_started_at.sql. It sets
-- `trial_started_at = now()` for every existing user, which the
-- subscription module reads as the trial anchor.
--
-- Two-step so users who haven't visited Settings yet (no profile row)
-- still get a trial:
--   1. Upsert a profile row for every auth user that doesn't have one.
--   2. Set trial_started_at = now() on every profile.
--
-- Safe to re-run — UPSERT is idempotent and the UPDATE just rolls the
-- anchor forward. If you only want to restart trials for SOME users,
-- replace the WHERE clauses below.

-- Step 1 — ensure every auth user has a profile row.
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 2 — start a fresh 7-day trial from now.
UPDATE public.profiles
SET trial_started_at = NOW();

-- Sanity check — how many rows were touched?
SELECT
  COUNT(*) AS profiles_with_fresh_trial,
  MIN(trial_started_at) AS earliest_anchor,
  MAX(trial_started_at) AS latest_anchor
FROM public.profiles
WHERE trial_started_at IS NOT NULL;
