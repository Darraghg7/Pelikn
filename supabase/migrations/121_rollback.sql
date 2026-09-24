-- Rollback for 121.
--
-- Drops the follow-up → issue link. Follow-ups keep their text, but the Open
-- issues timeline loses track of which issue each one belonged to. Only run
-- alongside reverting the client, which otherwise writes issue_id on every
-- follow-up and fails the insert.

DROP INDEX IF EXISTS pest_control_logs_issue_idx;
ALTER TABLE pest_control_logs DROP COLUMN IF EXISTS issue_id;
