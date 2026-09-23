-- 117 — stop every employee being able to read their colleagues' pay.
--
-- Depends on 116, which moved `staff` from a table-level SELECT grant to
-- column-level grants. That is what makes the REVOKE below effective: while a
-- role holds table-level SELECT, revoking a single column does nothing.
--
-- The exposure: since 113/114 scoped `staff` to the venue, any employee who
-- can log in can read every column of every colleague's row — including
-- hourly_rate. In a small venue where people work side by side, that is the
-- kind of thing that causes a real argument.
--
-- Column grants alone cannot fix this, because managers and plain staff
-- authenticate as the SAME Postgres role (`authenticated`, via the venue JWT
-- the pin-login function issues). Grants cannot tell them apart, so pay has to
-- move behind a SECURITY DEFINER function that inspects the session.
--
-- The UI already drew this line: RotaPage renders StaffRotaView to staff and
-- RotaWeekView to managers, and only the latter shows cost. This migration
-- makes the data layer enforce what the interface already assumed.

REVOKE SELECT (hourly_rate) ON staff FROM anon, authenticated;

-- Returns the pay rates the caller is entitled to see:
--   manager / owner → everyone in their venue, plus staff explicitly linked
--                     to it (114's cross-venue staff, who are rostered here
--                     and therefore cost this venue money)
--   anyone else     → their own rate only
--
-- Deliberately NOT an error for plain staff. Someone looking at their own
-- shifts has a legitimate need for their own rate, and returning one row is
-- simpler for the caller than branching on role before deciding which
-- function to call.
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
GRANT EXECUTE ON FUNCTION staff_pay_rates(uuid) TO anon, authenticated;
