-- ============================================================================
-- 059: Manager RPC to reset a staff member's PIN lockout
--
-- Allows a manager/owner to clear pin_failed_attempts and pin_locked_until
-- for any staff member at their venue, without needing Supabase dashboard
-- access.
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_staff_pin_lock(
  p_session_token uuid,
  p_staff_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue uuid;
BEGIN
  -- Verify caller is an active manager or owner
  SELECT ss.venue_id INTO v_venue
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
   WHERE ss.token      = p_session_token
     AND ss.expires_at > now()
     AND s.role IN ('manager', 'owner')
     AND s.is_active = true;

  IF v_venue IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Clear the lockout for the target staff member at this venue
  UPDATE staff
     SET pin_failed_attempts = 0,
         pin_locked_until    = NULL
   WHERE id        = p_staff_id
     AND venue_id  = v_venue;
END;
$$;
