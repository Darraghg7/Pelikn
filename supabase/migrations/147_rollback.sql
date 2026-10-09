-- ─────────────────────────────────────────────────────────────────────────────
-- 147_rollback.sql
-- Reverses 147_login_staff_colour.sql: list_venue_staff_for_login() goes back
-- to returning id, name, role and photo_url only, exactly as 113 defined it.
-- The app keeps working: login avatars just fall back to default colours.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS list_venue_staff_for_login(uuid);

CREATE FUNCTION list_venue_staff_for_login(p_venue_id uuid)
RETURNS TABLE (id uuid, name text, role text, photo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.role, s.photo_url
  FROM staff s
  WHERE s.venue_id = p_venue_id
    AND s.is_active = true
  ORDER BY s.sort_order, s.name
$$;

GRANT EXECUTE ON FUNCTION list_venue_staff_for_login(uuid) TO anon, authenticated;

COMMENT ON FUNCTION list_venue_staff_for_login(uuid) IS
  'Staff picker for the unauthenticated PIN login screen: id, name, role and '
  'photo_url for one venue''s active staff. Exists so the staff table itself '
  'no longer needs a public SELECT policy (113) — it deliberately exposes none '
  'of the pay, contact or HR columns that policy was leaking to every caller.';

COMMIT;
