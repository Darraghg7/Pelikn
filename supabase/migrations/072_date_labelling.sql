-- Migration 072: Date labelling / use-by records
-- Tracks when food items are opened and their in-use expiry dates for EHO compliance

CREATE TABLE IF NOT EXISTS date_labelling_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  item_name        text        NOT NULL,
  opened_date      date        NOT NULL,
  use_by_date      date        NOT NULL,
  storage_location text,
  notes            text,
  recorded_by      uuid        REFERENCES staff(id),
  recorded_by_name text,
  recorded_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE date_labelling_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "date_labelling_open" ON date_labelling_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX ON date_labelling_logs (venue_id, opened_date DESC);
