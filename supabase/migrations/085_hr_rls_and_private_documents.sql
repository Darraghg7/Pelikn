-- ============================================================================
-- 085: Align HR tables with the 091 access model + private document storage
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR                                    ║
-- ║  Prereqs: 083 and 084 applied (both are, as of 31 Jul 2026), and 091's    ║
-- ║  current_venue_id() / has_venue_access() present.                         ║
-- ║  ROLLBACK: see the block at the foot of this file.                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Fixes two things about 083/084:
--
-- 1. Their policies resolved the venue from `staff.venue_id` — the caller's
--    HOME venue — instead of the JWT venue claim every other table uses. A
--    manager who switched venues therefore saw nothing, because their JWT said
--    one venue and their staff row said another.
--
-- 2. The app uploads HR files to a `hr-documents` bucket that no migration
--    ever created, then calls getPublicUrl() on them. Contracts and
--    disciplinary letters must not sit on public URLs, so the bucket is
--    created here as PRIVATE and read through signed URLs instead.
--
-- Deliberately NOT added to 091's scoped-table list: that list applies
-- has_venue_access(), which grants any venue member access. HR records are
-- manager/owner only, so they keep the stricter policy defined below. If 091
-- is ever re-run, leave these two tables out of it.
-- ============================================================================


-- ── 1. Who may see HR records ────────────────────────────────────────────────
-- Venue comes from the JWT claim (authoritative for WHICH venue — pin-login and
-- switch_staff_venue only mint claims for venues the staff member is linked
-- to). Role comes from the staff row (authoritative for WHAT they may do).
-- Splitting it that way is what fixes the multi-venue case: the home venue on
-- the staff row is irrelevant to which venue they are currently working in.
CREATE OR REPLACE FUNCTION is_venue_hr_manager(p_venue uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_venue IS NOT NULL AND (
      -- PIN session: JWT venue claim matches and the caller is a manager/owner
      (p_venue = current_venue_id() AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = auth.uid()
          AND s.role IN ('manager', 'owner')
          AND s.is_active = true
      ))
      -- Supabase-Auth owner of the venue
      OR EXISTS (SELECT 1 FROM venues v WHERE v.id = p_venue AND v.owner_id = auth.uid())
    ),
    false)
$$;
GRANT EXECUTE ON FUNCTION is_venue_hr_manager(uuid) TO anon, authenticated;


-- ── 2. Repoint the 083/084 policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "venue managers can manage hr_formal_actions"   ON hr_formal_actions;
DROP POLICY IF EXISTS "hr_formal_actions_manager_access"              ON hr_formal_actions;
CREATE POLICY "hr_formal_actions_manager_access" ON hr_formal_actions
  FOR ALL
  USING      (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

DROP POLICY IF EXISTS "venue managers can manage staff_hr_documents"  ON staff_hr_documents;
DROP POLICY IF EXISTS "staff_hr_documents_manager_access"             ON staff_hr_documents;
CREATE POLICY "staff_hr_documents_manager_access" ON staff_hr_documents
  FOR ALL
  USING      (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

ALTER TABLE hr_formal_actions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_hr_documents ENABLE ROW LEVEL SECURITY;


-- ── 3. Store the storage key, not a public URL ───────────────────────────────
-- file_url stays for any row written before this migration; new rows record
-- file_path and the client mints a short-lived signed URL on read.
ALTER TABLE hr_formal_actions  ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE staff_hr_documents ADD COLUMN IF NOT EXISTS file_path text;

-- 084 declared file_url NOT NULL, which is wrong once the path is what matters.
ALTER TABLE staff_hr_documents ALTER COLUMN file_url  DROP NOT NULL;
ALTER TABLE staff_hr_documents ALTER COLUMN file_name DROP NOT NULL;


-- ── 4. Private hr-documents bucket ───────────────────────────────────────────
-- DO UPDATE, not DO NOTHING: if the bucket was already created as public, this
-- forces it private rather than silently leaving contracts world-readable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Object keys are `<venue_id>/<staff_id>/<timestamp>-<filename>`. Pull the
-- venue out of the first segment. Postgres does not guarantee AND short-circuits,
-- so a bad cast has to be swallowed here rather than guarded by a regex test.
CREATE OR REPLACE FUNCTION hr_object_venue(p_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN (storage.foldername(p_name))[1]::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;   -- unparseable key → is_venue_hr_manager(NULL) → false
END $$;
GRANT EXECUTE ON FUNCTION hr_object_venue(text) TO anon, authenticated;

DROP POLICY IF EXISTS "hr_documents_read"   ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_delete" ON storage.objects;

CREATE POLICY "hr_documents_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'hr-documents' AND is_venue_hr_manager(hr_object_venue(name))
  );

CREATE POLICY "hr_documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'hr-documents' AND is_venue_hr_manager(hr_object_venue(name))
  );

CREATE POLICY "hr_documents_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'hr-documents' AND is_venue_hr_manager(hr_object_venue(name))
  );


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP POLICY IF EXISTS "hr_documents_read"   ON storage.objects;
-- DROP POLICY IF EXISTS "hr_documents_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "hr_documents_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "hr_formal_actions_manager_access"  ON hr_formal_actions;
-- DROP POLICY IF EXISTS "staff_hr_documents_manager_access" ON staff_hr_documents;
-- CREATE POLICY "venue managers can manage hr_formal_actions" ON hr_formal_actions
--   USING (venue_id IN (SELECT venue_id FROM staff
--          WHERE id = auth.uid() AND role IN ('manager','owner') AND is_active = true));
-- CREATE POLICY "venue managers can manage staff_hr_documents" ON staff_hr_documents
--   USING (venue_id IN (SELECT venue_id FROM staff
--          WHERE id = auth.uid() AND role IN ('manager','owner') AND is_active = true));
-- DROP FUNCTION IF EXISTS hr_object_venue(text);
-- DROP FUNCTION IF EXISTS is_venue_hr_manager(uuid);
-- -- file_path columns are additive; leave them, or:
-- -- ALTER TABLE hr_formal_actions  DROP COLUMN IF EXISTS file_path;
-- -- ALTER TABLE staff_hr_documents DROP COLUMN IF EXISTS file_path;
