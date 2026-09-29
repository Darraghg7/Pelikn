-- ============================================================================
-- 137: Cleaning schedule in one call — tasks plus each task's last completion
--
-- Measured 29 Sep 2026. useCleaningTasks (Cleaning page, dashboard widget,
-- sidebar badge, Tasks page, department summary) loaded the venue's active
-- tasks and its newest 1,000 completions, only to find each task's latest
-- completion. Two problems:
--  - load: every staff tick refetches the whole 1,000 rows on every manager
--    screen that has cleaning open (realtime invalidation);
--  - correctness: at a busy venue 1,000 completions is a few weeks. A monthly
--    or quarterly task last done before that window had no "last completion"
--    and read as overdue.
--
-- This returns the active tasks and, per task, only its latest completion at
-- or before p_before (NULL = no cutoff; the Tasks page passes the end of a
-- past day it is showing). One row per task, served by the existing
-- (cleaning_task_id, completed_at DESC) index.
--
-- SECURITY INVOKER (the default) on purpose: respects the caller's RLS.
-- Returns the same columns fetchCleaningTasks selected. The client falls back
-- to its old two queries while this is missing.
--
-- Idempotent: CREATE OR REPLACE only, no table data touched.
-- Rollback: 137_rollback.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cleaning_state(
  p_venue_id uuid,
  p_before   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH tasks AS (
    SELECT id, title, frequency, department_id, is_active, venue_id, created_at
    FROM cleaning_tasks
    WHERE venue_id = p_venue_id AND is_active = true
  )
  SELECT jsonb_build_object(
    'tasks', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.title) FROM tasks t
    ), '[]'::jsonb),

    'completions', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.completed_at DESC)
      FROM tasks t
      CROSS JOIN LATERAL (
        SELECT id, cleaning_task_id, completed_at, completed_by_staff_id, completed_by_name, venue_id
        FROM cleaning_completions
        WHERE cleaning_task_id = t.id
          AND venue_id = p_venue_id
          AND (p_before IS NULL OR completed_at <= p_before)
        ORDER BY completed_at DESC
        LIMIT 1
      ) c
    ), '[]'::jsonb)
  )
$$;

COMMENT ON FUNCTION get_cleaning_state(uuid, timestamptz) IS
  'Active cleaning tasks plus each task''s latest completion (at or before '
  'p_before). Replaces loading the newest 1,000 completions. SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION get_cleaning_state(uuid, timestamptz) TO anon, authenticated;
