-- ============================================================================
-- 114: Let a venue read the staff who are LINKED to it — fixes a rota crash
--      introduced by 113
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR — this is a live-bug fix.          ║
-- ║  Safe in either order with the client: it only WIDENS access, so it       ║
-- ║  cannot break a client that is already working.                           ║
-- ║  ROLLBACK: 114_rollback.sql (restores 113's policy exactly).              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── What broke ──────────────────────────────────────────────────────────────
-- 113 scoped `staff` to has_venue_access(venue_id). That is right for a staff
-- member's own row, but it also filtered an EMBEDDED JOIN that the rota
-- depends on. fetchStaffList (src/lib/api/shifts.ts) runs:
--
--     .from('staff_venue_links')
--     .select('staff_id, role, staff(id, name, email, …)')
--     .eq('venue_id', venueId)
--
-- Cross-venue links exist precisely so a venue can roster someone whose HOME
-- venue is a different one. After 113 that embedded `staff(...)` resolved to
-- NULL, because the linked person's venue_id is not the caller's venue.
--
-- The client then did `{ ...l.staff, role, _crossVenue: true }` — spreading
-- null yields `{}` — so the staff list gained an entry with no id and no name,
-- and `s.name.split(' ')` in RotaWeekView threw. The whole rota page fell into
-- the error boundary: "This screen hit a snag".
--
-- Confirmed on production 22 Sep 2026: brew-and-bloom has one link row and its
-- embedded staff came back NULL. Any venue with a staff_venue_links row had a
-- broken rota.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
-- Readable if the row is in your venue, OR if that person is explicitly linked
-- to a venue you have access to. That is exactly the access the feature always
-- assumed, and it is still a closed set — a link row has to exist, so this
-- grants nothing to an unrelated venue. The cross-tenant hole 113 closed stays
-- closed.
--
-- The link check is SECURITY DEFINER on purpose: evaluating it inline would
-- apply staff_venue_links' own RLS inside a staff policy, which risks policy
-- recursion. A definer function reads the link table directly and returns a
-- plain boolean, exactly as has_venue_access() already does.
-- ============================================================================

CREATE OR REPLACE FUNCTION staff_is_linked_to_my_venue(p_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_venue_links svl
    WHERE svl.staff_id = p_staff_id
      AND has_venue_access(svl.venue_id)
  )
$$;

GRANT EXECUTE ON FUNCTION staff_is_linked_to_my_venue(uuid) TO anon, authenticated;

COMMENT ON FUNCTION staff_is_linked_to_my_venue(uuid) IS
  'True when the given staff member is linked to a venue the caller can access '
  '(staff_venue_links). SECURITY DEFINER so it can be used inside the staff '
  'SELECT policy without applying staff_venue_links RLS recursively (114).';


DROP POLICY IF EXISTS "staff_venue_select" ON staff;

CREATE POLICY "staff_venue_select" ON staff
  FOR SELECT USING (
    has_venue_access(venue_id)
    OR staff_is_linked_to_my_venue(id)
  );

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;


-- ── Verification (run after applying) ───────────────────────────────────────
-- The embedded join the rota needs should return a staff object, not null:
--   SELECT svl.staff_id, s.name
--   FROM staff_venue_links svl
--   LEFT JOIN staff s ON s.id = svl.staff_id
--   WHERE svl.venue_id = (SELECT id FROM venues WHERE slug = 'brew-and-bloom');
--
-- And an UNLINKED staff member from another venue must still be invisible —
-- run as a venue-scoped session, expect 0 rows:
--   SELECT count(*) FROM staff
--   WHERE venue_id <> current_venue_id()
--     AND NOT staff_is_linked_to_my_venue(id);
