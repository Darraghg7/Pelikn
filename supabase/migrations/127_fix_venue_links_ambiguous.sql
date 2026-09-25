-- ============================================================================
-- 127: get_staff_venue_links — fix "column reference venue_id is ambiguous"
--
-- Since 054 this function has failed on EVERY call with
--   42702 column reference "venue_id" is ambiguous
-- (confirmed 25 Sep 2026 via POST /rest/v1/rpc/get_staff_venue_links with a
-- real session token from brew-and-bloom).
--
-- Cause: RETURNS TABLE (venue_id, ...) makes venue_id a PL/pgSQL OUT variable
-- too, and 054's last line used a bare `venue_id` in
--   (SELECT venue_id FROM staff WHERE id = v_staff_id)
-- which Postgres can't resolve between the variable and staff.venue_id.
--
-- Both callers (pin-login edge function, SessionContext signIn) treat an
-- error as an empty list, so multi-venue staff silently saw no linked venues
-- in the picker or the overview.
--
-- Fix: qualify every column reference with a table alias. The body is
-- otherwise identical to 054 — same rows, same columns, same order.
--
-- Idempotent: CREATE OR REPLACE only, no table data touched. Existing grants
-- are kept by CREATE OR REPLACE.
-- Rollback: 127_rollback.sql
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
  SELECT ss.staff_id INTO v_staff_id
    FROM staff_sessions ss
   WHERE ss.token = p_session_token
     AND ss.expires_at > now();

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
       AND svl.venue_id <> (SELECT s2.venue_id FROM staff s2 WHERE s2.id = v_staff_id);
END;
$$;
