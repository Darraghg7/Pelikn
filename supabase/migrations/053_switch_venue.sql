-- ============================================================================
-- 053: switch_staff_venue — let multi-venue staff switch without re-entering PIN
--
-- When a staff member is linked to multiple venues, they log in with their PIN
-- once (at whichever venue's screen they're on), pick which venue they're
-- working at today from a picker, and the app calls this function to create a
-- fresh 30-day session for the chosen venue without requiring a second PIN entry.
--
-- Security: validates the current session is active, then checks the staff
-- member has access to the target venue (either as their primary venue or via
-- staff_venue_links). Creates a new session row rather than mutating the
-- existing one so both the original device and the new venue work independently.
-- ============================================================================

CREATE OR REPLACE FUNCTION switch_staff_venue(p_token uuid, p_venue_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff_id uuid;
  v_new_token uuid;
BEGIN
  -- Validate the current session
  SELECT staff_id INTO v_staff_id
    FROM staff_sessions
   WHERE token = p_token AND expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  -- Check the staff member has access to the target venue
  IF NOT EXISTS (
    SELECT 1 FROM staff
     WHERE id = v_staff_id AND venue_id = p_venue_id AND is_active = true
    UNION ALL
    SELECT 1 FROM staff_venue_links
     WHERE staff_id = v_staff_id AND venue_id = p_venue_id
  ) THEN
    RAISE EXCEPTION 'Not authorised for this venue';
  END IF;

  -- Create a fresh 30-day session for the target venue
  INSERT INTO staff_sessions (staff_id, venue_id, expires_at)
  VALUES (v_staff_id, p_venue_id, now() + interval '30 days')
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;
