-- ============================================================================
-- 069: Document vault
--
-- Upload and organise venue documents with optional expiry tracking.
-- ============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title       text NOT NULL,
  category    text NOT NULL CHECK (category IN ('licences','insurance','health_safety','eho_reports','other')),
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  file_size   bigint,
  expiry_date date,
  notes       text,
  uploaded_by uuid REFERENCES staff(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_read" ON documents
  FOR SELECT USING (true);

CREATE POLICY "documents_write" ON documents
  FOR ALL
  USING  (venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid()))
  WITH CHECK (venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid()));

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_documents_venue ON documents(venue_id, category, created_at DESC);
