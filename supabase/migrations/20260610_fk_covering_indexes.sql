-- 2026-06-10 — production-readiness audit fix.
-- Supabase performance advisor flagged two foreign keys without covering
-- indexes. Both point at job_weather_assessments(id); without an index,
-- every DELETE/UPDATE on the parent forces a sequential scan of the child.
-- Additive only — safe to apply on a live database.

create index if not exists ai_recommendations_assessment_id_idx
  on public.ai_recommendations (assessment_id);

create index if not exists customer_message_drafts_assessment_id_idx
  on public.customer_message_drafts (assessment_id);
