-- Rollback for 129_staff_notification_preferences_live.sql.
-- Returns the database to its pre-129 live state (nothing from 063 existed).
-- Drops any preferences staff saved after 129 was applied. If the repo's
-- send-push is deployed, typed pushes will fail again once the table is gone.
DROP FUNCTION IF EXISTS save_staff_notification_preference(uuid, text, boolean);
DROP FUNCTION IF EXISTS get_staff_notification_preferences(uuid);
DROP TABLE IF EXISTS staff_notification_preferences;
NOTIFY pgrst, 'reload schema';
