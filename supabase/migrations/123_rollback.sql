-- Rollback for 123.
--
-- Restores the venue-documents bucket to exactly what 123 found: its original
-- public flag and its original storage policies (recreated from the _backup_123
-- snapshot), plus the original documents policies. That RE-EXPOSES every
-- document and supplier certificate to anyone with the anon key, so only run
-- it alongside reverting the client.
--
-- file_path / food_safety_cert_path are additive and left in place. Rows
-- uploaded after 123 have no public URL, so one is rebuilt from the storage key
-- for the old client to use.

DO $$
DECLARE
  r record;
  roles_sql text;
  was_public boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _backup_123) THEN
    RAISE EXCEPTION '_backup_123 is empty — nothing to restore from. Stop and investigate.';
  END IF;

  -- 123's own policies
  DROP POLICY IF EXISTS "venue_documents_read"   ON storage.objects;
  DROP POLICY IF EXISTS "venue_documents_insert" ON storage.objects;
  DROP POLICY IF EXISTS "venue_documents_delete" ON storage.objects;
  DROP POLICY IF EXISTS "documents_select"       ON public.documents;
  DROP POLICY IF EXISTS "documents_insert"       ON public.documents;
  DROP POLICY IF EXISTS "documents_update"       ON public.documents;
  DROP POLICY IF EXISTS "documents_delete"       ON public.documents;

  -- Originals
  FOR r IN SELECT * FROM _backup_123 WHERE kind = 'policy' LOOP
    SELECT string_agg(CASE WHEN role = 'public' THEN 'public' ELSE quote_ident(role) END, ', ')
      INTO roles_sql FROM unnest(r.roles) AS role;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd, roles_sql,
      CASE WHEN r.qual       IS NOT NULL THEN ' USING ('      || r.qual       || ')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END);
  END LOOP;

  -- Bucket flag as it was (public, per the 24 Sep 2026 probe)
  SELECT bucket_public INTO was_public FROM _backup_123 WHERE kind = 'bucket';
  UPDATE storage.buckets SET public = coalesce(was_public, true) WHERE id = 'venue-documents';
END $$;

-- Give post-123 rows a public URL again, using the prefix of any legacy URL.
DO $$
DECLARE prefix text; n int;
BEGIN
  SELECT substring(u from '^(.*/object/public/venue-documents/)') INTO prefix
    FROM (SELECT file_url AS u FROM documents WHERE file_url LIKE '%/object/public/venue-documents/%'
          UNION ALL
          SELECT food_safety_cert_url FROM suppliers WHERE food_safety_cert_url LIKE '%/object/public/venue-documents/%') x
   LIMIT 1;

  IF prefix IS NOT NULL THEN
    UPDATE documents SET file_url = prefix || file_path
     WHERE file_url IS NULL AND file_path IS NOT NULL;
    UPDATE suppliers SET food_safety_cert_url = prefix || food_safety_cert_path
     WHERE food_safety_cert_url IS NULL AND food_safety_cert_path IS NOT NULL;
  END IF;

  SELECT count(*) INTO n FROM documents WHERE file_url IS NULL;
  IF n = 0 THEN
    ALTER TABLE documents ALTER COLUMN file_url SET NOT NULL;
  ELSE
    RAISE NOTICE '% documents row(s) still have no file_url (no legacy URL to copy the '
                 'prefix from); file_url left nullable.', n;
  END IF;
END $$;

-- Keep _backup_123 until the rollback is confirmed good, then:
-- DROP TABLE _backup_123;
