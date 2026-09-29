-- Rollback for 137_cleaning_state.sql.
-- Safe at any time: useCleaningTasks falls back to its own two queries when
-- the function is missing.
DROP FUNCTION IF EXISTS get_cleaning_state(uuid, timestamptz);
