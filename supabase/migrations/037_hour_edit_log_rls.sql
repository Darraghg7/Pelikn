-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: hour_edit_log was created in 036 without RLS enabled.
-- Managers can SELECT logs for their venue; inserts only go through the
-- SECURITY DEFINER log_hour_edit() function so no direct INSERT policy needed.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE hour_edit_log ENABLE ROW LEVEL SECURITY;

-- Allow SELECT so managers can read notifications for their venue.
-- The app uses the anon key (same pattern as all other tables in this project).
DROP POLICY IF EXISTS "hour_edit_log_select" ON hour_edit_log;
CREATE POLICY "hour_edit_log_select" ON hour_edit_log
  FOR SELECT USING (true);

-- No direct INSERT/UPDATE/DELETE — all writes go through log_hour_edit() SECURITY DEFINER.
