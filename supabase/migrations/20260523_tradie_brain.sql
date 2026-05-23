-- Tradie Brain v1 — private per-user memory layer.
--
-- One row per CONSOLIDATED memory. Repeated observations of the same fact
-- (same user + memory_type + memory_key) do NOT add rows — they bump
-- `strength` and `last_seen_at` via the upsert in store.ts. Confidence is
-- DERIVED from strength on read (not stored), so it can never drift.
--
-- Tradie Brain is advisory and contextual only. Nothing in this schema (or
-- the code that reads it) computes totals, edits a quote, sends a message,
-- or touches a validation / send gate. It only stores structured facts the
-- app learned from the tradie's own real actions, scoped to that tradie.
--
-- Safety:
--   * Additive only — no existing rows or tables touched.
--   * RLS scoped owner-only (auth.uid() = user_id), same pattern as
--     quote_edit_events / calendar_notes. No cross-user read or write is
--     possible: every policy pins user_id to the caller.
--   * NO delete policy. A wrong memory is ARCHIVED (status='archived'),
--     never hard-deleted — consistent with the project's no-destructive
--     -deletion rule.
--
-- Rollback (run manually if ever needed):
--   DROP TABLE public.tradie_memories;

CREATE TABLE IF NOT EXISTS public.tradie_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What kind of fact this is. Kept as text (not a PG enum) so adding a new
  -- memory type later is a code change, not a migration. Validated in TS by
  -- the MEMORY_TYPES union in tradieBrain/types.ts.
  --   preferred_material | preferred_brand | preferred_supplier |
  --   common_exclusion | pricing_habit | tone_preference |
  --   repeated_correction | job_type_preference | quote_outcome
  memory_type TEXT NOT NULL,

  -- Normalised dedup key WITHIN (user_id, memory_type). Drives consolidation:
  -- two observations with the same key are the same memory. Produced by
  -- normalizeMemoryKey() in TS so the DB never has to know the rules.
  memory_key TEXT NOT NULL,

  -- Structured payload; shape depends on memory_type (e.g. preferred_material
  -- => {name, unit, unit_price}). Always a JSON object, never free prose.
  value JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Observation count. Consolidation increments this; deriveConfidence() maps
  -- it to low/medium/high on read.
  strength INTEGER NOT NULL DEFAULT 1,

  -- Which real user action taught this most recently.
  --   quote_edit | material_correction | accepted_suggested_price |
  --   saved_exclusion | manual_pref | quote_outcome
  source TEXT NOT NULL,

  -- Provenance of the MOST RECENT observation: {quote_id, line_index,
  -- before, after, note}. Lets the owner debug view show "where did this
  -- come from" without joining back to the quote.
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- active | archived. Archiving (soft) is the only way to retire a wrong
  -- memory; there is no hard delete.
  status TEXT NOT NULL DEFAULT 'active',

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when retrieval surfaces this memory to a consumer. Null until used.
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The consolidation key. One memory per (user, type, key).
  CONSTRAINT tradie_memories_user_type_key_uniq
    UNIQUE (user_id, memory_type, memory_key)
);

COMMENT ON TABLE public.tradie_memories IS
  'Tradie Brain v1 — private per-user advisory memory. One row per consolidated fact learned from the tradie''s own actions. Advisory/contextual only: never computes totals, edits quotes, sends messages, or bypasses gates.';

-- Retrieval reads everything active for a user, then ranks in TS. Index on
-- (user_id, status) makes that read cheap; the recency index helps ordering.
CREATE INDEX IF NOT EXISTS tradie_memories_user_status_idx
  ON public.tradie_memories (user_id, status);
CREATE INDEX IF NOT EXISTS tradie_memories_user_type_idx
  ON public.tradie_memories (user_id, memory_type);
CREATE INDEX IF NOT EXISTS tradie_memories_user_last_seen_idx
  ON public.tradie_memories (user_id, last_seen_at DESC);

ALTER TABLE public.tradie_memories ENABLE ROW LEVEL SECURITY;

-- Owner-only, same shape as the rest of the app. No DELETE policy by design.
DROP POLICY IF EXISTS tradie_memories_select_own ON public.tradie_memories;
CREATE POLICY tradie_memories_select_own
  ON public.tradie_memories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS tradie_memories_insert_own ON public.tradie_memories;
CREATE POLICY tradie_memories_insert_own
  ON public.tradie_memories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tradie_memories_update_own ON public.tradie_memories;
CREATE POLICY tradie_memories_update_own
  ON public.tradie_memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
