-- Rollback for 122.
--
-- Drops the status, type, title and RIDDOR-tracking columns. Closure notes,
-- HSE reference numbers and report dates recorded since 122 are lost — export
-- them first if they matter. Rows that were flagged RIDDOR by the new page but
-- have a severity other than 'riddor' lose that flag. Only run alongside
-- reverting the client, which otherwise selects and writes these columns.

DROP INDEX IF EXISTS idx_incidents_venue_status;

ALTER TABLE incidents
  DROP COLUMN IF EXISTS closure_note,
  DROP COLUMN IF EXISTS closed_by,
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS riddor_reference,
  DROP COLUMN IF EXISTS riddor_reported_at,
  DROP COLUMN IF EXISTS riddor_category,
  DROP COLUMN IF EXISTS riddor,
  DROP COLUMN IF EXISTS incident_type,
  DROP COLUMN IF EXISTS title;
