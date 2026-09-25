-- ============================================================================
-- 124: Editing venue documents is manager-only
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. No client change depends on it:   ║
-- ║  the app has no edit flow for documents, so it can go in any time after   ║
-- ║  123 (applied 25 Sep 2026).                                               ║
-- ║  ROLLBACK: 124_rollback.sql (same folder).                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 123 made deleting a document manager/owner only but left UPDATE open to any
-- venue member, who could therefore rewrite a licence's title, category or
-- expiry date — or repoint file_path at a different file — through the API.
-- Same check as the delete rule: is_venue_hr_manager() (085), which matches
-- the client's isManager. Reading and adding stay venue-wide.
-- ============================================================================

-- ALTER rather than DROP + CREATE: one statement, one lock, and no moment
-- where the table has no UPDATE policy. The first attempt (DROP + CREATE,
-- 25 Sep 2026) hit a deadlock with live app traffic and rolled back cleanly.
-- lock_timeout makes a busy table fail fast instead of queueing behind — and
-- blocking — every app query; if it times out, nothing changed: run it again.
SET lock_timeout = '3s';

ALTER POLICY "documents_update" ON documents
  USING      (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));
