-- ============================================================================
-- Rollback for 113_staff_venue_scoped_select.sql
--
-- Restores the pre-113 state exactly: staff readable by any caller, which is
-- the behaviour the login screen depends on when the client is still on the
-- old code path.
--
-- ⚠ Running this REOPENS the cross-venue exposure 113 closed. Only use it if
-- the login screen breaks and you need the old client working immediately —
-- then re-apply 113 together with the LoginPage change.
--
-- The function is left in place (harmless, and the new client calls it). Drop
-- it explicitly only if you are reverting the client too.
-- ============================================================================

DROP POLICY IF EXISTS "staff_venue_select" ON staff;

CREATE POLICY "staff_select" ON staff FOR SELECT USING (true);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Optional, only when reverting the client as well:
-- DROP FUNCTION IF EXISTS list_venue_staff_for_login(uuid);
