-- Rollback for 160_venues_require_confirmed_email.sql.
-- Removes the confirmed-email check on new venues. Does not touch the
-- "Confirm email" setting in the Supabase dashboard.

SET lock_timeout = '5s';

DROP TRIGGER IF EXISTS venues_require_confirmed_owner ON venues;
DROP FUNCTION IF EXISTS venues_require_confirmed_owner();

RESET lock_timeout;
