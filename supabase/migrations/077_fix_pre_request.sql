-- ============================================================================
-- 077: Fix pre_request — remove invalid ss.is_active reference
--
-- Migration 076 queried staff_sessions.is_active which does not exist.
-- The runtime SQL error blocked every request that carried a session token
-- (including the PIN login RPC), causing "invalid PIN" for all returning users.
--
-- staff_sessions columns: token, staff_id, created_at, expires_at, venue_id
-- The active-staff check via s.is_active on the staff table is retained.
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
