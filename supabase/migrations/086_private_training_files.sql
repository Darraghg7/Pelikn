-- ============================================================================
-- 086: Make the training-files bucket private
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR, THEN DEPLOY THE MATCHING CODE.    ║
-- ║  Between the two, existing certificate links will not open (3 files at    ║
-- ║  the time of writing). Uploading and viewing both work again once the     ║
-- ║  client that reads file_path is live.                                     ║
-- ║  ROLLBACK: see the block at the foot of this file.                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 049 created training-files with public = true and three policies that let
-- ANY caller read, insert or delete ANY object in it:
--
--   CREATE POLICY "training_read" ON storage.objects
--     FOR SELECT USING (bucket_id = 'training-files');
--
-- The anon key those policies accept is shipped inside the client bundle, so
-- every training certificate in there is readable by anyone. Four features
-- write to this bucket — staff training certs (three upload paths) and
-- delivery photos — and all of them key objects as `<venue_id>/...`, so a
-- single venue-scoped rule covers the lot.
--
-- Read access is venue-level, not manager-only: unlike HR records (085) this
-- bucket holds operational material that ordinary staff legitimately see.
-- ============================================================================


-- ── 1. Venue from an object key ──────────────────────────────────────────────
-- Same job as 085's hr_object_venue(), kept separate so this migration does not
-- touch the working HR policies. Worth consolidating if a third bucket needs it.
-- Postgres does not guarantee AND short-circuits, so an unparseable first
-- segment has to be swallowed here rather than guarded by a regex test.
CREATE OR REPLACE FUNCTION storage_path_venue(p_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN (storage.foldername(p_name))[1]::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;   -- has_venue_access(NULL) is false → deny
END $$;
GRANT EXECUTE ON FUNCTION storage_path_venue(text) TO anon, authenticated;


-- ── 2. Record the storage key alongside the legacy URL ───────────────────────
ALTER TABLE staff_training  ADD COLUMN IF NOT EXISTS file_path  text;
ALTER TABLE delivery_checks ADD COLUMN IF NOT EXISTS photo_path text;

-- Backfill from the public URLs already stored. Keys are
-- `<uuid>/<uuid>/<epoch>.<ext>` — no characters that would need URL-decoding.
UPDATE staff_training
   SET file_path = substring(file_url from '/object/public/training-files/(.*)$')
 WHERE file_url IS NOT NULL
   AND file_path IS NULL
   AND file_url LIKE '%/object/public/training-files/%';

UPDATE delivery_checks
   SET photo_path = substring(photo_url from '/object/public/training-files/(.*)$')
 WHERE photo_url IS NOT NULL
   AND photo_path IS NULL
   AND photo_url LIKE '%/object/public/training-files/%';

-- Sanity check — fails the migration loudly rather than silently orphaning a
-- certificate whose URL did not match the expected shape.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM staff_training
   WHERE file_url IS NOT NULL AND file_path IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '% staff_training row(s) have a file_url that could not be converted '
                    'to a storage key. Inspect them before continuing.', n;
  END IF;
END $$;


-- ── 3. Close the bucket ──────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'training-files';

DROP POLICY IF EXISTS "training_upload"        ON storage.objects;
DROP POLICY IF EXISTS "training_read"          ON storage.objects;
DROP POLICY IF EXISTS "training_delete"        ON storage.objects;
DROP POLICY IF EXISTS "training_files_read"    ON storage.objects;
DROP POLICY IF EXISTS "training_files_insert"  ON storage.objects;
DROP POLICY IF EXISTS "training_files_delete"  ON storage.objects;

CREATE POLICY "training_files_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'training-files' AND has_venue_access(storage_path_venue(name))
  );

CREATE POLICY "training_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'training-files' AND has_venue_access(storage_path_venue(name))
  );

CREATE POLICY "training_files_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'training-files' AND has_venue_access(storage_path_venue(name))
  );


-- ============================================================================
-- ROLLBACK  (restores 049's behaviour, including its openness)
-- ============================================================================
-- UPDATE storage.buckets SET public = true WHERE id = 'training-files';
-- DROP POLICY IF EXISTS "training_files_read"   ON storage.objects;
-- DROP POLICY IF EXISTS "training_files_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "training_files_delete" ON storage.objects;
-- CREATE POLICY "training_read"   ON storage.objects FOR SELECT USING (bucket_id = 'training-files');
-- CREATE POLICY "training_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'training-files');
-- CREATE POLICY "training_delete" ON storage.objects FOR DELETE USING (bucket_id = 'training-files');
-- -- file_path / photo_path are additive and harmless; leave them in place.
