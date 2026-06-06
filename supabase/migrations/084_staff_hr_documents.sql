-- Staff-specific HR documents (contracts, food hygiene certs, etc.)
CREATE TABLE staff_hr_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id     uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  category     text        NOT NULL CHECK (category IN ('contract','food_hygiene','other')),
  file_url     text        NOT NULL,
  file_name    text        NOT NULL,
  file_size    int,
  expiry_date  date,
  notes        text,
  uploaded_by  uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_hr_docs_staff ON staff_hr_documents(staff_id, created_at DESC);
CREATE INDEX idx_staff_hr_docs_venue ON staff_hr_documents(venue_id, created_at DESC);

ALTER TABLE staff_hr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue managers can manage staff_hr_documents"
  ON staff_hr_documents
  USING (
    venue_id IN (
      SELECT venue_id FROM staff
      WHERE id = auth.uid() AND role IN ('manager','owner') AND is_active = true
    )
  );
