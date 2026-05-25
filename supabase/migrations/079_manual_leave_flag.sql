-- Add a flag to identify manually-entered pre-app leave records
-- These are approved leave entries managers log for paper records before joining Pelikn

ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS is_manual_entry boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN time_off_requests.is_manual_entry IS
  'True when a manager manually logged this leave (e.g. paper records from before the app was used)';
