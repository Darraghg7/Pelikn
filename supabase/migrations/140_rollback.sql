-- ============================================================================
-- 140 ROLLBACK: stop syncing calendar closed periods into venue_closures
--
-- APPLY MANUALLY IN SUPABASE SQL EDITOR.
--
-- Removes both triggers, their functions and the calendar_event_id link
-- column. Closures that 140's back-fill or triggers created are LEFT IN
-- PLACE: they are real closed periods managers entered in the calendar, and
-- deleting them would put checks back to overdue on those days. They become
-- ordinary closures (removable from the Rota or Venue Settings).
--
-- To also delete the closures 140 created, run this BEFORE the rollback
-- (it keeps 087's original copies, which pre-date 140):
--   DELETE FROM venue_closures
--   WHERE calendar_event_id IS NOT NULL
--     AND created_at >= '<time you applied 140>';
-- ============================================================================

SET lock_timeout = '5s';

DROP TRIGGER IF EXISTS manager_calendar_events_sync_closure ON manager_calendar_events;
DROP TRIGGER IF EXISTS venue_closures_delete_calendar_event ON venue_closures;
DROP FUNCTION IF EXISTS sync_calendar_closure();
DROP FUNCTION IF EXISTS delete_closure_calendar_event();

ALTER TABLE venue_closures DROP CONSTRAINT IF EXISTS venue_closures_calendar_event_id_key;
ALTER TABLE venue_closures DROP COLUMN IF EXISTS calendar_event_id;

RESET lock_timeout;
