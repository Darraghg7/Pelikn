-- Rollback for 119.
--
-- Restores table-level SELECT on time_off_requests, which re-opens `reason`
-- and `manager_note` to every employee in the venue. Only run alongside
-- reverting the client, which otherwise keeps calling time_off_private_fields
-- and fails with PGRST202.

REVOKE SELECT ON time_off_requests FROM anon, authenticated;
GRANT SELECT ON time_off_requests TO anon, authenticated;

DROP FUNCTION IF EXISTS time_off_private_fields(uuid);
