-- ── 042 Overview Dashboard ──────────────────────────────────────────────────
--
-- Adds a SECURITY DEFINER function to fetch the venues a staff member is
-- linked to (for the multi-venue overview dashboard).  Uses the session token
-- so the caller never passes a raw staff_id — identical pattern to all other
-- session-based RPCs.

CREATE OR REPLACE FUNCTION get_staff_venue_links(p_session_token uuid)
RETURNS TABLE (
  venue_id   uuid,
  venue_name text,
  venue_slug text,
  venue_plan text,
  link_role  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  SELECT staff_id INTO v_staff_id
    FROM staff_sessions
   WHERE token = p_session_token
     AND expires_at > now();

  IF v_staff_id IS NULL THEN
    RETURN; -- invalid / expired session
  END IF;

  RETURN QUERY
    SELECT svl.venue_id,
           v.name   AS venue_name,
           v.slug   AS venue_slug,
           v.plan   AS venue_plan,
           svl.role AS link_role
      FROM staff_venue_links svl
      JOIN venues             v ON v.id = svl.venue_id
     WHERE svl.staff_id = v_staff_id;
END;
$$;
