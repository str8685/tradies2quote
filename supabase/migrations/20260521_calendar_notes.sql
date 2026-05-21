-- Calendar notes — personal day-notes the tradie adds on the dashboard
-- schedule calendar. Independent of quotes/jobs: a free-text reminder
-- pinned to a date (e.g. "order GIB", "site meeting 9am", "RDO").
--
-- Additive only — no existing rows touched. Owner-only via RLS, the same
-- pattern as the rest of the app (auth.uid() = user_id). Multiple notes
-- per day are allowed (each its own row).
--
-- Rollback (run manually if needed):
--   DROP TABLE public.calendar_notes;

CREATE TABLE IF NOT EXISTS public.calendar_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.calendar_notes IS
  'Personal day-notes shown on the dashboard schedule calendar. Not tied to a quote. Owner-only.';

CREATE INDEX IF NOT EXISTS calendar_notes_user_date_idx
  ON public.calendar_notes (user_id, note_date);

ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_notes_select_own ON public.calendar_notes;
CREATE POLICY calendar_notes_select_own
  ON public.calendar_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS calendar_notes_insert_own ON public.calendar_notes;
CREATE POLICY calendar_notes_insert_own
  ON public.calendar_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS calendar_notes_update_own ON public.calendar_notes;
CREATE POLICY calendar_notes_update_own
  ON public.calendar_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS calendar_notes_delete_own ON public.calendar_notes;
CREATE POLICY calendar_notes_delete_own
  ON public.calendar_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
