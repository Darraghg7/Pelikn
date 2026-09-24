-- ============================================================================
-- 121: Link pest follow-ups and treatments to the issue they're about
--
-- The redesigned Pest control page shows each open issue with a timeline:
-- the original sighting, then every treatment and follow-up logged against it.
-- Until now nothing recorded which issue a later entry belonged to.
--
--   - issue_id points a follow-up (or a treatment done for an existing issue)
--     at the sighting/treatment that opened the issue. NULL = the entry is not
--     about an existing issue (inspections, and entries that open a new issue).
--   - Open issues are sightings/treatments with status 'open' and no issue_id.
--   - ON DELETE SET NULL keeps the follow-up record if the issue row is removed.
--
-- Additive only — existing rows keep issue_id NULL and read exactly as before.
-- ============================================================================

ALTER TABLE pest_control_logs
  ADD COLUMN IF NOT EXISTS issue_id uuid REFERENCES pest_control_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pest_control_logs_issue_idx
  ON pest_control_logs (issue_id) WHERE issue_id IS NOT NULL;
