-- Follow-up to 155 (found when checking it on the live database).
--
--   1. create_venue_with_owner had two versions side by side: the old 4-argument
--      one from 017 and the 5-argument one from 023b/155. The signup page calls
--      it with four named arguments, which can reach the old one, and the old
--      one stores whatever PIN it is given, including an empty one. Drop the
--      old version; the 5-argument one answers the same call.
--   2. Postgres lets everyone run a new function unless told otherwise, so the
--      two PIN functions from 155 were runnable by the anon role. They already
--      refuse callers who are not signed in, but they should not be reachable
--      at all. Only signed-in users keep access.
--
-- Rollback: 156_rollback.sql.

SET lock_timeout = '5s';

BEGIN;

DROP FUNCTION IF EXISTS create_venue_with_owner(text, text, text, text);

REVOKE ALL ON FUNCTION owner_pin_pending(uuid)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_owner_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION owner_pin_pending(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION set_owner_pin(uuid, text) TO authenticated;

COMMIT;
