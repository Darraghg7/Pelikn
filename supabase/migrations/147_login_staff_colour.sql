-- ─────────────────────────────────────────────────────────────────────────────
-- 147_login_staff_colour.sql
-- PIN login picker: also return each person's saved rota colour.
-- ROLLBACK: 147_rollback.sql (same folder).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Every staff avatar is drawn on the person's rota colour (staff.colour),
-- falling back to a default worked out from their id. The login screen reads
-- staff through list_venue_staff_for_login() (113), which only returned id,
-- name, role and photo_url — so anyone with a hand-picked colour showed their
-- default colour on the login screen and a different one everywhere else.
--
-- This adds `colour` to what the function returns. Nothing else changes: same
-- argument, same rows (one venue's active staff), same order, still SECURITY
-- DEFINER with search_path = public, still executable by anon and
-- authenticated. colour is a display hex code (#3b82f6), not sensitive.
--
-- Postgres can't change a function's return columns with CREATE OR REPLACE,
-- so it is dropped and recreated inside one transaction: the login screen
-- never sees the function missing, and the grant is re-made exactly as 113
-- made it.
--
-- Safe to run before or after the app update: the app treats a missing
-- colour as "use the default", which is what it shows today.

BEGIN;

DROP FUNCTION IF EXISTS list_venue_staff_for_login(uuid);

CREATE FUNCTION list_venue_staff_for_login(p_venue_id uuid)
RETURNS TABLE (id uuid, name text, role text, photo_url text, colour text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.role, s.photo_url, s.colour
  FROM staff s
  WHERE s.venue_id = p_venue_id
    AND s.is_active = true
  ORDER BY s.sort_order, s.name
$$;

GRANT EXECUTE ON FUNCTION list_venue_staff_for_login(uuid) TO anon, authenticated;

COMMENT ON FUNCTION list_venue_staff_for_login(uuid) IS
  'Staff picker for the unauthenticated PIN login screen: id, name, role, '
  'photo_url and rota colour for one venue''s active staff. Exists so the staff '
  'table itself no longer needs a public SELECT policy (113) — it deliberately '
  'exposes none of the pay, contact or HR columns that policy was leaking to '
  'every caller. colour added in 147 so login avatars match every other screen.';

COMMIT;

-- ── Check it worked ──────────────────────────────────────────────────────────
-- Should list your staff with a colour column (NULL for anyone who has never
-- had a colour picked):
--   SELECT * FROM list_venue_staff_for_login(
--     (SELECT id FROM venues WHERE slug = 'your-venue-slug'));
