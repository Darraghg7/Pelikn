-- Rollback for 118.
--
-- Restores the five columns to the grant, re-opening them to every employee
-- in the venue. Only run alongside reverting the client, which otherwise
-- keeps calling staff_private_fields and fails with PGRST202.
--
-- staff_pay_rates is restored to 117's standalone form rather than dropped:
-- 117 is still applied, and leaving it pointing at session_actor while that
-- function is dropped would break pay everywhere.

GRANT SELECT (
  email,
  emergency_contact_name,
  emergency_contact_phone,
  start_date,
  contracted_hours
) ON staff TO anon, authenticated;

DROP FUNCTION IF EXISTS staff_private_fields(uuid);

CREATE OR REPLACE FUNCTION staff_pay_rates(p_session_token uuid)
RETURNS TABLE (staff_id uuid, hourly_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
  v_staff_id uuid;
  v_role     text;
BEGIN
  SELECT ss.venue_id, s.id, s.role
    INTO v_venue_id, v_staff_id, v_role
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no active session';
  END IF;

  IF v_role IN ('manager', 'owner') THEN
    RETURN QUERY
      SELECT s.id, s.hourly_rate
      FROM staff s
      WHERE s.venue_id = v_venue_id
         OR EXISTS (
              SELECT 1 FROM staff_venue_links svl
              WHERE svl.staff_id = s.id AND svl.venue_id = v_venue_id
            );
  ELSE
    RETURN QUERY
      SELECT s.id, s.hourly_rate
      FROM staff s
      WHERE s.id = v_staff_id;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS session_actor(uuid);
