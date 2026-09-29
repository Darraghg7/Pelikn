-- Rollback for 136_team_and_checks_status.sql.
-- Safe at any time: useTeamStatus and useChecksStatus fall back to their own
-- per-table queries when these functions are missing.
DROP FUNCTION IF EXISTS get_team_status(uuid, timestamptz, timestamptz, date, date, date, date, text, date, date);
DROP FUNCTION IF EXISTS get_checks_status(uuid, timestamptz, timestamptz);
