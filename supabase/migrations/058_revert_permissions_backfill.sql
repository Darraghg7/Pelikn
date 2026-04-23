-- ============================================================================
-- 058: Revert automatic permissions backfill (migration 055)
--
-- Migration 055 automatically granted all 5 default permissions to any active
-- staff member with zero permissions. This was too broad — permissions should
-- be configured per staff member by the manager via Settings → Staff Members.
--
-- This migration removes those automatically inserted rows. It only targets
-- staff members who have exactly 5 permissions AND whose permissions were all
-- created on or after 2026-04-22 (the date 055 ran). Staff whose permissions
-- were manually configured by a manager are unaffected.
-- ============================================================================

DELETE FROM staff_permissions
WHERE (staff_id, venue_id) IN (
  -- Staff who have exactly 5 total permissions (the backfill set) and nothing else
  SELECT staff_id, venue_id
  FROM staff_permissions
  GROUP BY staff_id, venue_id
  HAVING COUNT(*) = 5
)
AND created_at >= '2026-04-22T00:00:00Z';
