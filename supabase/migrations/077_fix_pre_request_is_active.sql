-- ============================================================================
-- 077: Fix pre_request() — remove ss.is_active predicate
--
-- staff_sessions has no is_active column. Migration 076's pre_request() used
-- AND ss.is_active = true which threw a PostgreSQL runtime error on every
-- request carrying an x-pelikn-session header. This caused set_config() to
-- never fire, so app.current_venue_id was never set, and all venue-scoped
-- RLS policies denied every row.
--
-- Fix: remove the invalid predicate. Session validity is already guaranteed
-- by expires_at > now(); the staff.is_active = true check on the JOIN to
-- staff is sufficient to reject disabled staff members.
--
-- REMINDER — manual step required in Supabase dashboard (one time only):
--   Settings → API → Pre-request function → set to: public.pre_request
-- ============================================================================

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
    AND s.is_active   = true
  LIMIT 1;

  IF v_venue_id IS NOT NULL THEN
    PERFORM set_config('app.current_venue_id', v_venue_id::text, true);
  END IF;
END;
$$;
