-- Rollback for 124: editing documents goes back to any venue member (123's rule).
-- If it times out on the lock, nothing changed: run it again.

SET lock_timeout = '3s';

ALTER POLICY "documents_update" ON documents
  USING      (has_venue_access(venue_id))
  WITH CHECK (has_venue_access(venue_id));
