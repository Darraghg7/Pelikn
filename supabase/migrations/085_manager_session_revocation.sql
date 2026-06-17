-- Add device_label to staff_sessions for display purposes
ALTER TABLE staff_sessions
  ADD COLUMN IF NOT EXISTS device_label text;

-- List active sessions for a staff member (manager-scoped)
CREATE OR REPLACE FUNCTION list_staff_sessions(
  p_session_token uuid,
  p_staff_id      uuid
)
RETURNS TABLE (
  token       uuid,
  venue_id    uuid,
  venue_name  text,
  device_label text,
  created_at  timestamptz,
  expires_at  timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_manager_venue_id uuid;
BEGIN
  -- Validate calling manager's session and get their venue
  SELECT ss.venue_id INTO v_manager_venue_id
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
   WHERE ss.token      = p_session_token
     AND ss.expires_at > now()
     AND s.is_active   = true
     AND s.role IN ('manager', 'owner');

  IF v_manager_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;

  -- Confirm the target staff belongs to the manager's venue
  IF NOT EXISTS (
    SELECT 1 FROM staff
     WHERE id = p_staff_id AND venue_id = v_manager_venue_id
  ) THEN
    RAISE EXCEPTION 'Staff not found in your venue';
  END IF;

  RETURN QUERY
    SELECT ss.token, ss.venue_id, v.name AS venue_name,
           ss.device_label, ss.created_at, ss.expires_at
      FROM staff_sessions ss
      JOIN venues v ON v.id = ss.venue_id
     WHERE ss.staff_id   = p_staff_id
       AND ss.expires_at > now()
     ORDER BY ss.created_at DESC;
END;
$$;

-- Revoke a specific session (manager-scoped — can only revoke sessions in their venue)
CREATE OR REPLACE FUNCTION revoke_staff_session(
  p_session_token uuid,
  p_target_token  uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_manager_venue_id uuid;
BEGIN
  SELECT ss.venue_id INTO v_manager_venue_id
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
   WHERE ss.token      = p_session_token
     AND ss.expires_at > now()
     AND s.is_active   = true
     AND s.role IN ('manager', 'owner');

  IF v_manager_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;

  -- Only delete the target if it belongs to a staff member in the manager's venue
  DELETE FROM staff_sessions
   WHERE token = p_target_token
     AND venue_id = v_manager_venue_id;
END;
$$;
