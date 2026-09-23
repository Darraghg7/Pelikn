-- 119 — stop colleagues reading why someone booked time off.
--
-- REQUIRES 118: uses session_actor(p_session_token), introduced there.
--
-- Same shape as the staff fixes (116–118), one table over. 091 scoped
-- time_off_requests to the venue, but venue-scoping is not role-scoping:
-- has_venue_access() is the same for a manager and a kitchen porter, so every
-- employee could read every colleague's row, including:
--
--   reason        — written by the requester. For time off this is routinely
--                   medical or bereavement: "hospital appointment", "funeral".
--   manager_note  — the manager's own comment on the request.
--
-- Knowing WHO is off on Thursday is legitimate and the rota needs it. Knowing
-- WHY is nobody else's business. This was reachable in normal use, not just
-- via the API: useAvailability selects `reason` for every approved request in
-- the venue and puts it in the rota's day note, which staff can see.
--
-- Rule: managers and owners see the whole venue. Everyone else sees only their
-- own requests — including manager_note, which is feedback on their own
-- request ("declined, we're short that week") and which they should read.

REVOKE SELECT ON time_off_requests FROM anon, authenticated;

-- Every column except reason and manager_note. Enumerated rather than
-- generated so the set is reviewable in the diff. Note this makes `select('*')`
-- fail for these roles — two callers were using it and are fixed in this PR.
GRANT SELECT (
  id,
  staff_id,
  venue_id,
  start_date,
  end_date,
  status,
  leave_type,
  reviewed_by,
  reviewed_at,
  cancelled_at,
  cancelled_by,
  created_at
) ON time_off_requests TO anon, authenticated;

-- Writes are unaffected: the INSERT/UPDATE paths still need to set reason and
-- manager_note, and column-level SELECT grants do not constrain them. Row-level
-- policies remain the only thing governing writes here, exactly as before.

CREATE OR REPLACE FUNCTION time_off_private_fields(p_session_token uuid)
RETURNS TABLE (
  request_id   uuid,
  reason       text,
  manager_note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE a record;
BEGIN
  a := session_actor(p_session_token);

  RETURN QUERY
    SELECT t.id, t.reason, t.manager_note
    FROM time_off_requests t
    WHERE CASE WHEN a.is_manager
      THEN t.venue_id = a.venue_id
      ELSE t.staff_id = a.staff_id
    END;
END;
$$;
GRANT EXECUTE ON FUNCTION time_off_private_fields(uuid) TO anon, authenticated;
