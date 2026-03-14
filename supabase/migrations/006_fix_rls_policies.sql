-- Fix RLS policies that incorrectly check auth.role() = 'authenticated'.
-- This app uses custom PIN-based sessions (not Supabase Auth), so
-- auth.role() is always 'anon'. Permission enforcement is handled at the
-- application layer, so we open up write policies to allow all.

-- shifts
DROP POLICY IF EXISTS "shifts_manager_write" ON shifts;
CREATE POLICY "shifts_all_write" ON shifts
  FOR ALL USING (true) WITH CHECK (true);

-- app_settings
DROP POLICY IF EXISTS "settings_manager_write" ON app_settings;
CREATE POLICY "settings_all_write" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

-- task_templates
DROP POLICY IF EXISTS "task_templates_manager_write" ON task_templates;
CREATE POLICY "task_templates_all_write" ON task_templates
  FOR ALL USING (true) WITH CHECK (true);

-- task_one_offs
DROP POLICY IF EXISTS "task_one_offs_manager_write" ON task_one_offs;
CREATE POLICY "task_one_offs_all_write" ON task_one_offs
  FOR ALL USING (true) WITH CHECK (true);

-- cleaning_tasks
DROP POLICY IF EXISTS "cleaning_tasks_manager_write" ON cleaning_tasks;
CREATE POLICY "cleaning_tasks_all_write" ON cleaning_tasks
  FOR ALL USING (true) WITH CHECK (true);
