-- Rollback for 116.
--
-- Restores table-level SELECT (and the write grants) on `staff`, which also
-- restores read access to pin_hash. Only run this if 116 broke a read path
-- that cannot wait for a forward fix — it re-opens the PIN-hash exposure
-- described in 116's header.
--
-- Dropping the column-level grants first matters: leaving them behind
-- alongside a table-level grant is harmless but makes the privilege state
-- confusing to audit later.

REVOKE SELECT ON staff FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staff TO anon, authenticated;
