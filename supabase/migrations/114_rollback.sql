-- ============================================================================
-- Rollback for 114_staff_select_linked_venues.sql
--
-- Restores 113's policy exactly (venue-scoped only, no linked-staff clause).
--
-- ⚠ Running this re-breaks the rota page for any venue that has a
-- staff_venue_links row, unless the client-side guard in fetchStaffList is
-- also deployed — that guard drops null embedded joins, so the page degrades
-- to "cross-venue staff missing from the rota" instead of crashing.
-- ============================================================================

DROP POLICY IF EXISTS "staff_venue_select" ON staff;

CREATE POLICY "staff_venue_select" ON staff
  FOR SELECT USING (has_venue_access(venue_id));

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Optional:
-- DROP FUNCTION IF EXISTS staff_is_linked_to_my_venue(uuid);
