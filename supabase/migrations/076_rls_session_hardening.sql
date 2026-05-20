-- ============================================================================
-- 076: RLS session hardening
--
-- This app uses custom PIN-based sessions (not Supabase Auth), so
-- auth.role() is always 'anon' and JWT claims cannot carry identity.
-- Previous migrations used USING (true) to work around this, leaving all
-- rows readable/writable by anyone with the anon key.
--
-- This migration introduces proper venue-scoped RLS by:
--
--  1. A pre_request() function that PostgREST calls before every request.
--     It reads the X-Pelikn-Session header, validates the token against
--     staff_sessions, and sets app.current_venue_id for the transaction.
--
--  2. A current_session_venue_id() helper used in all RLS policies.
--
--  3. Updated policies on all tables that were previously USING (true),
--     replacing them with venue_id = current_session_venue_id() checks.
--
-- SETUP REQUIRED IN SUPABASE DASHBOARD:
--   Settings → API → "Extra search path" — add: extensions
--   Settings → API → "Pre-request function" — set to: public.pre_request
--   (PostgREST will then call pre_request() before every authenticated request.)
-- ============================================================================

-- ── 1. Pre-request function ───────────────────────────────────────────────────
-- Called by PostgREST before every request. Reads the X-Pelikn-Session header,
-- validates the token, and sets app.current_venue_id for the current transaction.
CREATE OR REPLACE FUNCTION pre_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token    text;
  v_venue_id uuid;
BEGIN
  BEGIN
    v_token := current_setting('request.headers', true)::json->>'x-pelikn-session';
  EXCEPTION WHEN OTHERS THEN
    v_token := NULL;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RETURN;
  END IF;

  SELECT s.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token      = v_token::uuid
    AND ss.expires_at > now()
    AND ss.is_active  = true
    AND s.is_active   = true
  LIMIT 1;

  IF v_venue_id IS NOT NULL THEN
    PERFORM set_config('app.current_venue_id', v_venue_id::text, true);
  END IF;
END;
$$;

-- ── 2. Venue-ID helper ───────────────────────────────────────────────────────
-- Returns the venue UUID set by pre_request(), or NULL if no valid session.
-- NULL will never equal any venue_id, so policies default to DENY when
-- no session header is present.
CREATE OR REPLACE FUNCTION current_session_venue_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT NULLIF(current_setting('app.current_venue_id', true), '')::uuid
$$;

-- ── 3. Replace USING (true) policies on core tables ──────────────────────────

-- shifts
DROP POLICY IF EXISTS "shifts_all_write"   ON shifts;
DROP POLICY IF EXISTS "shifts_venue_access" ON shifts;
CREATE POLICY "shifts_venue_access" ON shifts
  FOR ALL
  USING  (venue_id = current_session_venue_id())
  WITH CHECK (venue_id = current_session_venue_id());

-- app_settings
DROP POLICY IF EXISTS "settings_all_write"   ON app_settings;
DROP POLICY IF EXISTS "settings_venue_access" ON app_settings;
CREATE POLICY "settings_venue_access" ON app_settings
  FOR ALL
  USING  (venue_id = current_session_venue_id())
  WITH CHECK (venue_id = current_session_venue_id());

-- task_templates
DROP POLICY IF EXISTS "task_templates_all_write"   ON task_templates;
DROP POLICY IF EXISTS "task_templates_venue_access" ON task_templates;
CREATE POLICY "task_templates_venue_access" ON task_templates
  FOR ALL
  USING  (venue_id = current_session_venue_id())
  WITH CHECK (venue_id = current_session_venue_id());

-- task_one_offs
DROP POLICY IF EXISTS "task_one_offs_all_write"   ON task_one_offs;
DROP POLICY IF EXISTS "task_one_offs_venue_access" ON task_one_offs;
CREATE POLICY "task_one_offs_venue_access" ON task_one_offs
  FOR ALL
  USING  (venue_id = current_session_venue_id())
  WITH CHECK (venue_id = current_session_venue_id());

-- cleaning_tasks
DROP POLICY IF EXISTS "cleaning_tasks_all_write"   ON cleaning_tasks;
DROP POLICY IF EXISTS "cleaning_tasks_venue_access" ON cleaning_tasks;
CREATE POLICY "cleaning_tasks_venue_access" ON cleaning_tasks
  FOR ALL
  USING  (venue_id = current_session_venue_id())
  WITH CHECK (venue_id = current_session_venue_id());

-- task_completions (if exists — scoped via task relationship or direct venue_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_completions' AND column_name = 'venue_id'
  ) THEN
    DROP POLICY IF EXISTS "task_completions_all_write" ON task_completions;
    DROP POLICY IF EXISTS "task_completions_venue_access" ON task_completions;
    EXECUTE $p$
      CREATE POLICY "task_completions_venue_access" ON task_completions
        FOR ALL
        USING  (venue_id = current_session_venue_id())
        WITH CHECK (venue_id = current_session_venue_id())
    $p$;
  END IF;
END;
$$;
