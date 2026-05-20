-- ============================================================================
-- 078: Revert venue-scoped RLS back to open access
--
-- Migration 076 introduced venue-scoped RLS policies that depend on a
-- pre_request() hook being registered in the Supabase Data API settings.
-- That setting is not available on the free Supabase plan, so
-- current_session_venue_id() always returns NULL and every policy
-- introduced by 076 denies all rows.
--
-- This migration restores the original USING (true) policies so all
-- authenticated requests (scoped only by the anon key) can read/write data.
-- ============================================================================

-- shifts
DROP POLICY IF EXISTS "shifts_venue_access" ON shifts;
DROP POLICY IF EXISTS "shifts_all_write"    ON shifts;
CREATE POLICY "shifts_venue_access" ON shifts
  FOR ALL USING (true) WITH CHECK (true);

-- app_settings
DROP POLICY IF EXISTS "settings_venue_access" ON app_settings;
DROP POLICY IF EXISTS "settings_all_write"    ON app_settings;
CREATE POLICY "settings_venue_access" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

-- task_templates
DROP POLICY IF EXISTS "task_templates_venue_access" ON task_templates;
DROP POLICY IF EXISTS "task_templates_all_write"    ON task_templates;
CREATE POLICY "task_templates_venue_access" ON task_templates
  FOR ALL USING (true) WITH CHECK (true);

-- task_one_offs
DROP POLICY IF EXISTS "task_one_offs_venue_access" ON task_one_offs;
DROP POLICY IF EXISTS "task_one_offs_all_write"    ON task_one_offs;
CREATE POLICY "task_one_offs_venue_access" ON task_one_offs
  FOR ALL USING (true) WITH CHECK (true);

-- cleaning_tasks
DROP POLICY IF EXISTS "cleaning_tasks_venue_access" ON cleaning_tasks;
DROP POLICY IF EXISTS "cleaning_tasks_all_write"    ON cleaning_tasks;
CREATE POLICY "cleaning_tasks_venue_access" ON cleaning_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- task_completions (only if the table has a venue_id column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_completions' AND column_name = 'venue_id'
  ) THEN
    DROP POLICY IF EXISTS "task_completions_venue_access" ON task_completions;
    DROP POLICY IF EXISTS "task_completions_all_write"    ON task_completions;
    EXECUTE $p$
      CREATE POLICY "task_completions_venue_access" ON task_completions
        FOR ALL USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;
