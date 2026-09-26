-- Rollback for 128_tip_allocations_venue_rls.sql.
-- Restores 068's policies verbatim. NOTE: that brings the bug back — PIN-signed-in
-- managers can't save tip allocations, and anon can read every venue's allocations.
DROP POLICY IF EXISTS "tip_allocations_select" ON tip_allocations;
DROP POLICY IF EXISTS "tip_allocations_insert" ON tip_allocations;
DROP POLICY IF EXISTS "tip_allocations_update" ON tip_allocations;
DROP POLICY IF EXISTS "tip_allocations_delete" ON tip_allocations;

CREATE POLICY "tip_allocations_read" ON tip_allocations
  FOR SELECT USING (true);

CREATE POLICY "tip_allocations_write" ON tip_allocations
  FOR ALL
  USING  (EXISTS (
    SELECT 1 FROM tip_splits ts
    JOIN venues v ON v.id = ts.venue_id
    WHERE ts.id = tip_allocations.tip_split_id AND v.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tip_splits ts
    JOIN venues v ON v.id = ts.venue_id
    WHERE ts.id = tip_allocations.tip_split_id AND v.owner_id = auth.uid()
  ));
