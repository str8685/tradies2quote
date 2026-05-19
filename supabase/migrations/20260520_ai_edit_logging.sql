-- Wave 40 — AI edit logging.
--
-- Goal: spot where the AI is systematically wrong by capturing the
-- diff between what the AI generated and what the tradie actually
-- saved. Powers the "eval loop" — once we have a few hundred edits
-- across a few quote types we can read the patterns and harden
-- the generation prompt with evidence instead of guessing.
--
-- Two additions, both additive (no destructive changes):
--
--   1. `quotes.ai_snapshot` (jsonb, nullable)
--      Frozen QuoteData written ONCE at generation time inside
--      /api/quotes/generate. Never updated afterwards — `quote_data`
--      keeps mutating on every edit, this column does not. Nullable
--      so quotes generated before this migration still load.
--
--   2. `quote_edit_events` (new table)
--      One row per save. Stores the user_data at that moment and
--      the structured diff against the AI snapshot. Joined back to
--      `quotes.ai_snapshot` when we want the original baseline.
--
-- Safety:
--   * No existing rows touched.
--   * RLS scoped owner-only, same pattern as the rest of the app.
--   * No data leaks via the new table — only the owner can read
--     their own edit events.
--
-- Rollback (run manually if needed):
--   DROP TABLE public.quote_edit_events;
--   ALTER TABLE public.quotes DROP COLUMN ai_snapshot;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS ai_snapshot JSONB;

COMMENT ON COLUMN public.quotes.ai_snapshot IS
  'Frozen QuoteData JSON written once at generation. Source of truth for "what did the AI originally produce" — quote_data mutates on every edit, this does not.';

CREATE TABLE IF NOT EXISTS public.quote_edit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edited_data JSONB NOT NULL,
  diff JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.quote_edit_events IS
  'One row per saveQuoteChanges call. diff is a structured before/after vs quotes.ai_snapshot — feeds the eval loop for prompt improvement.';

CREATE INDEX IF NOT EXISTS quote_edit_events_quote_id_idx
  ON public.quote_edit_events (quote_id);
CREATE INDEX IF NOT EXISTS quote_edit_events_user_id_created_at_idx
  ON public.quote_edit_events (user_id, created_at DESC);

ALTER TABLE public.quote_edit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY quote_edit_events_select_own
  ON public.quote_edit_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY quote_edit_events_insert_own
  ON public.quote_edit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
