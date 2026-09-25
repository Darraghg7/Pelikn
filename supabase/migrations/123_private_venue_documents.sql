-- ============================================================================
-- 123: Make the venue-documents bucket private
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR, THEN DEPLOY THE MATCHING CODE.    ║
-- ║  Between the two, existing document and supplier-certificate links will  ║
-- ║  not open (the live client still uses the stored public URL). Uploads     ║
-- ║  keep working throughout. Everything opens again once the client that    ║
-- ║  reads file_path / food_safety_cert_path is live.                         ║
-- ║  Prereqs: 085 (is_venue_hr_manager), 086 (storage_path_venue) and 091     ║
-- ║  (has_venue_access) applied.                                              ║
-- ║  ROLLBACK: 123_rollback.sql (same folder).                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- The document vault (premises licences, insurance certificates, EHO reports)
-- and supplier food-safety certificates are uploaded to `venue-documents`,
-- which was created by hand in the dashboard as a PUBLIC bucket, and the app
-- stored getPublicUrl() links. Probed read-only with the anon key on
-- 24 Sep 2026: the bucket answers "Object not found" (public) rather than
-- "Bucket not found" (private), anon can LIST it, and an unauthenticated GET
-- of a stored file returns 200. Anyone holding the anon key shipped in the
-- client bundle can therefore enumerate and download every venue's files.
--
-- Same fix as training-files (086): private bucket, objects scoped by the
-- venue in the first key segment, rows store the key and the client mints a
-- 60-second signed URL on open. Read access is venue-level (has_venue_access),
-- not manager-only: staff already see the document list in the app.
--
-- The documents table itself: 069 created `documents_read USING (true)`. 091
-- listed `documents` as a SCOPED table (not public-read), which replaced that
-- policy, and the anon probe returns zero rows. Section 4 re-asserts the
-- scoped policy name-agnostically anyway, so this migration leaves the table
-- closed whatever state it finds it in.
-- ============================================================================


-- ── 0. Snapshot what is about to be replaced, for 123_rollback.sql ───────────
-- The venue-documents policies were created in the dashboard, so no migration
-- records their names or definitions. Copy them before dropping. The table is
-- unreachable through the API: RLS on with no policies, and no grants.
CREATE TABLE IF NOT EXISTS _backup_123 (
  kind        text NOT NULL,      -- 'policy' | 'bucket'
  schemaname  text,
  tablename   text,
  policyname  text,
  permissive  text,
  roles       name[],
  cmd         text,
  qual        text,
  with_check  text,
  bucket_public boolean,
  saved_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE _backup_123 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON _backup_123 FROM anon, authenticated;

-- Only snapshot on the first run, so a re-run cannot overwrite the originals
-- with this migration's own policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _backup_123) THEN
    INSERT INTO _backup_123 (kind, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
    SELECT 'policy', schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE (schemaname = 'storage' AND tablename = 'objects'
            AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%venue-documents%')
        OR (schemaname = 'public' AND tablename = 'documents');

    INSERT INTO _backup_123 (kind, bucket_public)
    SELECT 'bucket', public FROM storage.buckets WHERE id = 'venue-documents';
  END IF;
END $$;


-- ── 1. Venue from an object key (defined in 086; repeated for fresh DBs) ─────
CREATE OR REPLACE FUNCTION storage_path_venue(p_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN (storage.foldername(p_name))[1]::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;   -- has_venue_access(NULL) is false → deny
END $$;
GRANT EXECUTE ON FUNCTION storage_path_venue(text) TO anon, authenticated;


-- ── 2. Record the storage key alongside the legacy URL ───────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS food_safety_cert_path text;

-- New rows carry file_path only; a public URL is meaningless once the bucket
-- is private.
ALTER TABLE documents ALTER COLUMN file_url DROP NOT NULL;

-- Backfill from the public URLs already stored. Supplier keys are sanitised to
-- [A-Za-z0-9._-]; document keys are `<uuid>/<epoch>-<hex>.<ext>` where only
-- the extension came from the user, so %20 is the one escape worth undoing.
UPDATE documents
   SET file_path = replace(substring(file_url from '/object/public/venue-documents/([^?#]*)'), '%20', ' ')
 WHERE file_url IS NOT NULL
   AND file_path IS NULL
   AND file_url LIKE '%/object/public/venue-documents/%';

UPDATE suppliers
   SET food_safety_cert_path = replace(substring(food_safety_cert_url from '/object/public/venue-documents/([^?#]*)'), '%20', ' ')
 WHERE food_safety_cert_url IS NOT NULL
   AND food_safety_cert_path IS NULL
   AND food_safety_cert_url LIKE '%/object/public/venue-documents/%';

-- Fail loudly rather than silently orphan a file whose URL had another shape.
DO $$
DECLARE n_docs int; n_sup int; n_missing int;
BEGIN
  SELECT count(*) INTO n_docs FROM documents
   WHERE file_url IS NOT NULL AND file_path IS NULL;
  SELECT count(*) INTO n_sup FROM suppliers
   WHERE food_safety_cert_url IS NOT NULL AND food_safety_cert_path IS NULL;
  IF n_docs > 0 OR n_sup > 0 THEN
    RAISE EXCEPTION '% documents row(s) and % suppliers row(s) have a URL that could not be '
                    'converted to a storage key. Inspect them before continuing.', n_docs, n_sup;
  END IF;

  -- Keys that do not match a stored object will not open. Reported, not
  -- fatal: a file deleted from the dashboard leaves exactly this behind.
  SELECT count(*) INTO n_missing FROM (
    SELECT file_path AS p FROM documents WHERE file_path IS NOT NULL
    UNION ALL
    SELECT food_safety_cert_path FROM suppliers WHERE food_safety_cert_path IS NOT NULL
  ) k
  WHERE NOT EXISTS (SELECT 1 FROM storage.objects o
                     WHERE o.bucket_id = 'venue-documents' AND o.name = k.p);
  IF n_missing > 0 THEN
    RAISE NOTICE '% backfilled key(s) have no matching object in venue-documents; '
                 'those rows will show "Could not open the file".', n_missing;
  END IF;
END $$;


-- ── 3. Close the bucket ──────────────────────────────────────────────────────
-- Upsert, as in 085: force it private whether or not it already exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-documents', 'venue-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop every existing policy that mentions this bucket, whatever it is called
-- (they were made in the dashboard). The snapshot above holds the originals.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%venue-documents%'
  LOOP
    RAISE NOTICE 'Dropping storage policy %', r.policyname;
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "venue_documents_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'venue-documents' AND has_venue_access(storage_path_venue(name))
  );

CREATE POLICY "venue_documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'venue-documents' AND has_venue_access(storage_path_venue(name))
  );

-- Deleting a licence or certificate is a manager decision (see section 4).
CREATE POLICY "venue_documents_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'venue-documents' AND is_venue_hr_manager(storage_path_venue(name))
  );

-- A policy that ignores bucket_id (e.g. USING (true)) would still expose the
-- bucket. None is expected; flag one rather than silently leaving it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND cmd IN ('SELECT', 'ALL')
              AND coalesce(qual, '') NOT LIKE '%bucket_id%'
  LOOP
    RAISE WARNING 'storage.objects policy % does not filter on bucket_id and may still '
                  'expose venue-documents. Review it.', r.policyname;
  END LOOP;
END $$;


-- ── 4. documents: venue members read/add, managers delete ────────────────────
-- Reading and adding match what 091 left in place. Dropped name-agnostically
-- so a stray USING (true) policy (069's documents_read, or anything added by
-- hand) cannot OR itself back in.
--
-- DELETE is manager/owner only. 091's single FOR ALL policy let any venue
-- member delete a premises licence or insurance certificate; the app only ever
-- showed the upload button to managers, so no staff flow depended on it.
-- is_venue_hr_manager() (085) is the manager/owner check — venue from the JWT
-- claim, role from the staff row, plus Supabase-Auth venue owners — and matches
-- the client's isManager. Its name is HR-specific; the rule is not.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (has_venue_access(venue_id));

CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (has_venue_access(venue_id));

CREATE POLICY "documents_update" ON documents
  FOR UPDATE
  USING      (has_venue_access(venue_id))
  WITH CHECK (has_venue_access(venue_id));

CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (is_venue_hr_manager(venue_id));

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
