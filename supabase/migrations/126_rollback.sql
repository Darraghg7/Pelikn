-- Rollback for 126_app_bootstrap.sql.
-- Safe at any time: every hook falls back to its own query when the function
-- is missing.
DROP FUNCTION IF EXISTS get_app_bootstrap(uuid, uuid, text[], date, timestamptz, timestamptz, timestamptz);
