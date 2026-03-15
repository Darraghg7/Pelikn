-- ============================================================================
-- 013: Time-off requests with calendar view
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_off_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  reason       text,
  status       text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_by  uuid REFERENCES staff(id),
  reviewed_at  timestamptz,
  manager_note text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_off_read  ON time_off_requests;
DROP POLICY IF EXISTS time_off_write ON time_off_requests;
CREATE POLICY time_off_read  ON time_off_requests FOR SELECT USING (true);
CREATE POLICY time_off_write ON time_off_requests FOR ALL    USING (true) WITH CHECK (true);
