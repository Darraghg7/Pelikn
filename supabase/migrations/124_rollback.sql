-- Rollback for 124: editing documents goes back to any venue member (123's rule).

DROP POLICY IF EXISTS "documents_update" ON documents;

CREATE POLICY "documents_update" ON documents
  FOR UPDATE
  USING      (has_venue_access(venue_id))
  WITH CHECK (has_venue_access(venue_id));
