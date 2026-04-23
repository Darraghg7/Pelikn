-- ============================================================================
-- 055: backfill missing staff permissions + index for session cleanup
--
-- Migration 050 fixed create_staff_member to seed default permissions, but
-- staff created via direct INSERT or before 050 ran were missed. This
-- backfills any active staff member with zero permission rows.
--
-- Also adds a missing index on staff_sessions(staff_id, expires_at) that
-- speeds up session cleanup on login (DELETE WHERE staff_id = ? AND expires_at < now())
-- — at high concurrency this was a sequential scan.
-- ============================================================================

-- Backfill: grant the 5 default permissions to any active staff member
-- who currently has no entries in staff_permissions at all.
INSERT INTO staff_permissions (staff_id, venue_id, permission)
SELECT s.id, s.venue_id, p.perm
FROM staff s
CROSS JOIN (VALUES
  ('log_temps'),
  ('view_temp_logs'),
  ('manage_cleaning'),
  ('manage_tasks'),
  ('manage_opening')
) AS p(perm)
WHERE s.role = 'staff'
  AND s.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM staff_permissions sp
    WHERE sp.staff_id = s.id
      AND sp.venue_id = s.venue_id
  )
ON CONFLICT (staff_id, venue_id, permission) DO NOTHING;

-- Index for fast session cleanup during login
CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff_id
  ON staff_sessions (staff_id, expires_at);
