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

DROP POLICY IF EXISTS "documents_update" ON documents;

CREATE POLICY "documents_update" ON documents
  FOR UPDATE
  USING      (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));
