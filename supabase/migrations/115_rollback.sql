-- Rollback for 115.
--
-- Safe to run: these functions are additive. 115 changed no policies and no
-- data, so dropping them puts the database back exactly where it was.
--
-- Note what "back" means: staff edits, deletes and reordering return to
-- silently doing nothing (see 115's header). Only roll this back alongside
-- reverting the client, or the app will call functions that no longer exist
-- and fail with PGRST202 — loudly, but on every save.

DROP FUNCTION IF EXISTS reorder_venue_staff(uuid, uuid[]);
DROP FUNCTION IF EXISTS delete_staff_member(uuid, uuid);
DROP FUNCTION IF EXISTS update_staff_fields(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS manager_venue_for_session(uuid);
