-- ============================================================================
-- 054: get_staff_venue_links — include primary venue in results
--
-- Previously only returned venues from staff_venue_links (the "extra" venues).
-- This meant a multi-venue staff member who joined via a non-primary venue's
-- code would only see that one venue in the post-login picker — their primary
-- venue was invisible.
--
-- Fix: UNION in the staff member's primary venue (staff.venue_id) so the
-- function always returns ALL venues they can access regardless of which
-- venue code they used to reach the login screen.
-- ============================================================================

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
    RETURN;
  END IF;

  RETURN QUERY
    -- Primary venue
    SELECT s.venue_id,
           v.name   AS venue_name,
           v.slug   AS venue_slug,
           v.plan   AS venue_plan,
           'primary'::text AS link_role
      FROM staff   s
      JOIN venues  v ON v.id = s.venue_id
     WHERE s.id = v_staff_id
    UNION ALL
    -- Additional linked venues (exclude primary to avoid duplicates)
    SELECT svl.venue_id,
           v.name   AS venue_name,
           v.slug   AS venue_slug,
           v.plan   AS venue_plan,
           svl.role AS link_role
      FROM staff_venue_links svl
      JOIN venues             v ON v.id = svl.venue_id
     WHERE svl.staff_id = v_staff_id
       AND svl.venue_id <> (SELECT venue_id FROM staff WHERE id = v_staff_id);
END;
$$;
