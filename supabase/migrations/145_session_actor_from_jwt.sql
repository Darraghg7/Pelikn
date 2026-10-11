-- 145 — pay and contract details stop failing on devices that are signed in.
--
-- What happened (8 Oct 2026, 11:43:44): two `Unauthorized: no active session`
-- errors, one from staff_pay_rates and one from staff_private_fields, on a
-- device where every other screen was loading normally.
--
-- Why: a PIN sign-in hands the device two separate credentials —
--
--   • a venue JWT, which every table read and most RPCs use. Postgres trusts
--     it on its signature and expiry alone (30 days); nothing ever checks it
--     against staff_sessions.
--   • a staff_sessions token, which a handful of older RPCs take as an
--     argument and look up in the table.
--
-- The two have independent lifetimes, so the token can die while the JWT
-- carries on: a manager revoking the device from the staff record (085's
-- revoke_staff_session deletes the row), the row reaching expires_at while a
-- JWT re-issued later still has days left, or the device restoring a session
-- after validate_staff_session timed out and never finding out the token had
-- gone. In every case the app looks signed in — because, as far as the data is
-- concerned, it is — and only the token-checked RPCs refuse. 117–119 put pay,
-- contract details and time-off reasons behind exactly that kind of RPC.
--
-- The fix: session_actor, the one place 118 put the "who is asking" decision,
-- now identifies the caller the same way RLS and 139's clock guards do — the
-- JWT's subject (auth.uid()) at the JWT's venue (current_venue_id()). Only if
-- the request has no usable venue JWT does it fall back to the token, exactly
-- as before, so no caller that works today stops working.
--
-- This grants nothing new. The JWT that now passes this check already lets the
-- same device read the staff table, the rota and the timesheets; requiring a
-- second, separately-expiring credential for three RPCs protected nothing and
-- just made them the first thing to break. A deactivated account is still
-- refused (is_active is checked on both paths).
--
-- staff_pay_rates, staff_private_fields and time_off_private_fields all call
-- session_actor, so all three are fixed without touching them. The signature
-- is unchanged; the token argument is still accepted and still used as the
-- fallback.
--
-- The error now carries SQLSTATE 42501 (insufficient_privilege) instead of the
-- default P0001, so the app can tell "you are not allowed" from a fault.

CREATE OR REPLACE FUNCTION session_actor(
  p_session_token uuid,
  OUT venue_id    uuid,
  OUT staff_id    uuid,
  OUT is_manager  boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_venue  uuid := current_venue_id();
BEGIN
  -- 1. The venue JWT — the same identity every other read on the device uses.
  --    The venue must be the person's home venue or one 114 linked them to —
  --    the same venues issue_jwt will sign for. (139's staff_works_at_venue
  --    says the same thing; it is spelled out here so 145 does not depend on
  --    139 having been applied.)
  IF v_caller IS NOT NULL AND v_venue IS NOT NULL THEN
    SELECT v_venue, s.id, s.role IN ('manager', 'owner')
      INTO venue_id, staff_id, is_manager
    FROM staff s
    WHERE s.id = v_caller
      AND s.is_active = true
      AND (s.venue_id = v_venue
           OR EXISTS (SELECT 1 FROM staff_venue_links svl
                      WHERE svl.staff_id = s.id AND svl.venue_id = v_venue));

    IF staff_id IS NOT NULL THEN
      RETURN;
    END IF;
  END IF;

  -- 2. No usable venue JWT (an owner signed in by email whose venue JWT has
  --    lapsed, say): 118's token lookup, unchanged.
  SELECT ss.venue_id, s.id, s.role IN ('manager', 'owner')
    INTO venue_id, staff_id, is_manager
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.is_active = true;

  IF venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no active session'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION session_actor(uuid) TO anon, authenticated;

COMMENT ON FUNCTION session_actor(uuid) IS
  'Who is asking, for the manager/self split in staff_pay_rates, '
  'staff_private_fields and time_off_private_fields. Venue JWT first '
  '(auth.uid() at current_venue_id()), staff_sessions token as fallback (145).';
