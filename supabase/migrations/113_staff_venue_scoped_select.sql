-- ============================================================================
-- 113: Stop the staff table being readable by the whole internet
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR                                    ║
-- ║  Deploy the client change in the SAME window — LoginPage must already be  ║
-- ║  calling list_venue_staff_for_login() before the policy below lands, or   ║
-- ║  the staff picker on the login screen goes empty for everyone.            ║
-- ║  ROLLBACK: 113_rollback.sql (same folder).                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── The problem ─────────────────────────────────────────────────────────────
-- 091 left staff with exactly one policy:
--
--     CREATE POLICY "staff_select" ON staff FOR SELECT USING (true);
--
-- commented "public SELECT for the login screen; writes via SECURITY DEFINER
-- RPCs only". The reasoning is sound — the PIN login screen has to list staff
-- names before anyone is authenticated — but the grant is the entire table for
-- every venue, and the anon key that satisfies it ships in the client bundle
-- by design. So the audience is not "a logged-in manager", it is anyone.
--
-- Confirmed on production 22 Sep 2026: a session scoped to one venue read
-- staff rows belonging to three other venues, including a live customer. The
-- test account has no linked venues, so this was not multi-venue access.
--
-- staff carries name, email, hourly_rate, contracted_hours, employment_type,
-- start_date, emergency_contact_name, emergency_contact_phone, is_under_18 and
-- pin_hash. Pay, emergency contacts and minor status for every employee of
-- every customer. The login screen needs four of those columns, for one venue.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
-- 1. A SECURITY DEFINER function returning ONLY the login-relevant columns for
--    ONE venue, which anon may execute. This is strictly less than the login
--    screen can see today.
-- 2. The blanket SELECT policy is replaced with the same has_venue_access()
--    scoping every other table already uses.
--
-- ── Deliberately NOT in this migration ──────────────────────────────────────
-- * Sensitive columns stay readable to authenticated members OF THE SAME
--   VENUE, so any staff member can still read a colleague's hourly_rate. That
--   is a real concern and worth a follow-up, but it needs a product decision
--   about who may see pay, and Postgres RLS is row-level — restricting columns
--   means a view or column GRANTs, which is a much wider change. This
--   migration closes the cross-tenant hole, which is the part that leaks one
--   customer's data to another.
-- * The silent write failures (see 113_staff_delete_member.sql for delete).
--   UPDATE on staff has also been a no-op since 091 dropped staff_all_write —
--   verified on production: PATCH returns HTTP 200 with 0 rows affected, so
--   contracted hours, working days, emergency contacts, staff reordering and
--   photo uploads have all been silently discarded. Fixing that means deciding
--   who may edit which fields; it is not bundled in here.
-- ============================================================================

-- ── 1. Login-screen staff list ──────────────────────────────────────────────
-- SECURITY DEFINER so it still works with no session at all. Returns the exact
-- four columns LoginPage renders (id, name, role, photo_url) and nothing else,
-- for a single venue, active staff only. Ordering matches the query it
-- replaces: sort_order then name, and ASC puts NULL sort_order last.
CREATE OR REPLACE FUNCTION list_venue_staff_for_login(p_venue_id uuid)
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


-- ── 2. Scope the table ──────────────────────────────────────────────────────
-- Same predicate as every table 091 scoped via _pk_scope: the row's venue
-- matches the caller's JWT venue claim, or the caller owns the venue through
-- Supabase Auth. Anon gets NULL for both and is denied — which is why step 1
-- has to be deployed first.
DROP POLICY IF EXISTS "staff_select" ON staff;

CREATE POLICY "staff_venue_select" ON staff
  FOR SELECT USING (has_venue_access(venue_id));

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Note: no INSERT/UPDATE/DELETE policy is added here, which preserves the
-- current behaviour exactly — those have been denied since 091 and every
-- working staff write already goes through a SECURITY DEFINER RPC
-- (create_staff_member, update_staff_member, deactivate_staff_member, …).


-- ── Verification (run after applying) ───────────────────────────────────────
-- Expect: one row, 'staff_venue_select', and NOT 'true' as the qual.
--   SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid = 'public.staff'::regclass;
--
-- Expect: the four login columns, for that venue only.
--   SELECT * FROM list_venue_staff_for_login(
--     (SELECT id FROM venues WHERE slug = 'brew-and-bloom'));
