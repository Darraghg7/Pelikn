-- HR formal disciplinary actions (verbal/written warnings, dismissals, etc.)
CREATE TABLE hr_formal_actions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id     uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  action_type  text        NOT NULL CHECK (action_type IN (
                             'verbal_warning','written_warning',
                             'final_written_warning','dismissal','other')),
  occurred_at  date        NOT NULL,
  notes        text,
  file_url     text,
  file_name    text,
  added_by     uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_formal_actions_staff   ON hr_formal_actions(staff_id, occurred_at DESC);
CREATE INDEX idx_hr_formal_actions_venue   ON hr_formal_actions(venue_id, occurred_at DESC);

ALTER TABLE hr_formal_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue managers can manage hr_formal_actions"
  ON hr_formal_actions
  USING (
    venue_id IN (
      SELECT venue_id FROM staff
      WHERE id = auth.uid() AND role IN ('manager','owner') AND is_active = true
    )
  );
