-- 118 — close the rest of the staff column exposure.
--
-- 116 withheld pin_hash and 117 withheld hourly_rate. These were the remaining
-- columns any employee in the venue could read off a colleague's row:
--
--   email, emergency_contact_name, emergency_contact_phone,
--   start_date, contracted_hours
--
-- Lower severity than pay or a PIN hash, but still personal data that a
-- colleague has no reason to see — an emergency contact is someone's next of
-- kin, and a start date and contracted hours are employment terms.
--
-- Same mechanism as 117: the REVOKE works only because 116 moved `staff` off
-- a table-level grant, and the manager/self split has to live in a SECURITY
-- DEFINER function because managers and staff share one Postgres role.

REVOKE SELECT (
  email,
  emergency_contact_name,
  emergency_contact_phone,
  start_date,
  contracted_hours
) ON staff FROM anon, authenticated;

-- ── Shared session resolution ───────────────────────────────────────────────
-- 117's staff_pay_rates inlined this. A second function needing the same
-- manager/self decision is exactly how two copies of a security check drift
-- apart, so it is factored out here and staff_pay_rates is rewritten below to
-- use it. Same reasoning as manager_venue_for_session in 115 — which is NOT
-- reusable here because it raises for non-managers, and these functions must
-- serve a plain staff member their own row.
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

-- ── Private fields ──────────────────────────────────────────────────────────
-- manager / owner → everyone in their venue, plus staff linked to it
-- anyone else     → their own row only
--
-- Note `email` is included for completeness even though the only screen that
-- reads it is the manager-only staff settings list; the rota was selecting it
-- without ever using it, and that select is removed rather than routed here.
CREATE OR REPLACE FUNCTION staff_private_fields(p_session_token uuid)
RETURNS TABLE (
  staff_id                uuid,
  email                   text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  start_date              date,
  contracted_hours        numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE a record;
BEGIN
  a := session_actor(p_session_token);

  RETURN QUERY
    SELECT s.id, s.email, s.emergency_contact_name, s.emergency_contact_phone,
           s.start_date, s.contracted_hours
    FROM staff s
    WHERE CASE WHEN a.is_manager
      THEN s.venue_id = a.venue_id
           OR EXISTS (SELECT 1 FROM staff_venue_links svl
                      WHERE svl.staff_id = s.id AND svl.venue_id = a.venue_id)
      ELSE s.id = a.staff_id
    END;
END;
$$;
GRANT EXECUTE ON FUNCTION staff_private_fields(uuid) TO anon, authenticated;

-- ── Rewrite 117's staff_pay_rates onto the shared helper ────────────────────
-- Signature and return type are unchanged, so this is a drop-in replacement.
-- Behaviour is intentionally identical — the point is that the manager/self
-- rule now lives in exactly one place.
CREATE OR REPLACE FUNCTION staff_pay_rates(p_session_token uuid)
RETURNS TABLE (staff_id uuid, hourly_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE a record;
BEGIN
  a := session_actor(p_session_token);

  RETURN QUERY
    SELECT s.id, s.hourly_rate
    FROM staff s
    WHERE CASE WHEN a.is_manager
      THEN s.venue_id = a.venue_id
           OR EXISTS (SELECT 1 FROM staff_venue_links svl
                      WHERE svl.staff_id = s.id AND svl.venue_id = a.venue_id)
      ELSE s.id = a.staff_id
    END;
END;
$$;
GRANT EXECUTE ON FUNCTION staff_pay_rates(uuid) TO anon, authenticated;
