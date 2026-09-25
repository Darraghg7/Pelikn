-- Rollback for 125_manager_notifications_data.sql.
-- Safe at any time: useNotifications falls back to its per-table queries
-- when the function is missing.
DROP FUNCTION IF EXISTS get_manager_notifications_data(uuid, date, date, date, date, timestamptz, timestamptz, timestamptz, timestamptz);
