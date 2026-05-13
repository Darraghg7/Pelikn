-- ============================================================================
-- 068: Tip splits & allocations
--
-- Manager-only feature for distributing tips across staff.
-- ============================================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE tip_splits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  split_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_by   uuid NOT NULL REFERENCES staff(id),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tip_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_split_id uuid NOT NULL REFERENCES tip_splits(id) ON DELETE CASCADE,
  staff_id     uuid NOT NULL REFERENCES staff(id),
  amount       numeric(10,2) NOT NULL CHECK (amount >= 0)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE tip_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tip_splits_read" ON tip_splits
  FOR SELECT USING (true);

CREATE POLICY "tip_splits_write" ON tip_splits
  FOR ALL
  USING  (venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid()))
  WITH CHECK (venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid()));

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
    WHERE ts.id = tip_split_id AND v.owner_id = auth.uid()
  ));

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_tip_splits_venue_date ON tip_splits(venue_id, split_date DESC);
CREATE INDEX idx_tip_allocations_split ON tip_allocations(tip_split_id);
