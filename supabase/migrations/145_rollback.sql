-- Rollback for 145.
--
-- Restores 118's session_actor: the caller is identified by the
-- staff_sessions token only. Devices whose token has died while their venue
-- JWT is still valid go back to failing pay, contract and time-off-reason
-- reads with `Unauthorized: no active session`.
--
-- Safe to run on its own — the app sends the token on every call either way
-- and handles both error codes.

CREATE OR REPLACE FUNCTION session_actor(
  p_session_token uuid,
  OUT venue_id    uuid,
  OUT staff_id    uuid,
  OUT is_manager  boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT ss.venue_id, s.id, s.role IN ('manager', 'owner')
    INTO venue_id, staff_id, is_manager
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.is_active = true;

  IF venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no active session';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION session_actor(uuid) TO anon, authenticated;

COMMENT ON FUNCTION session_actor(uuid) IS NULL;
