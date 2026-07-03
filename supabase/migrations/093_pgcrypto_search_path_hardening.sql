-- ============================================================================
-- 093: Permanently defuse the pgcrypto / search_path landmine
--
-- INCIDENT (3 July 2026): every staff PIN login failed with
--   "function crypt(text, text) does not exist"
-- surfacing in the app as "Incorrect PIN". Root cause: functions that call
-- crypt()/gen_salt() (pgcrypto) were created with SET search_path = public
-- (a security-hardening pattern), which breaks whenever pgcrypto's objects
-- are not in the public schema. The same failure happened once before and
-- was fixed for SOME functions by 049_fix_staff_rpcs (search_path =
-- public, extensions) — but 057 later recreated the PIN-verify function
-- with the broken public-only pin.
--
-- This migration:
--   1. Guarantees pgcrypto is installed.
--   2. Re-pins EVERY function in public that references crypt()/gen_salt()
--      to search_path = public, extensions — found dynamically, so it also
--      covers functions recreated by re-running old migration files.
--
-- Idempotent and data-safe: touches function metadata only, no table data.
-- Run AFTER any re-run of an old migration that defines staff/PIN functions.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  f record;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND (p.prosrc ILIKE '%crypt(%' OR p.prosrc ILIKE '%gen_salt(%')
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f.sig);
    n := n + 1;
    RAISE NOTICE 'PELIKN 093: pinned search_path = public, extensions on %', f.sig;
  END LOOP;
  RAISE NOTICE 'PELIKN 093: % function(s) re-pinned', n;
END $$;

-- Proof: crypt resolves and no crypt-using function remains unpinned.
-- (The SET is needed so the probe itself can see pgcrypto wherever it lives.)
SET search_path = public, extensions;
SELECT
  crypt('probe', gen_salt('bf')) IS NOT NULL                    AS pgcrypto_working,
  (SELECT count(*)
   FROM pg_proc p
   JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND (p.prosrc ILIKE '%crypt(%' OR p.prosrc ILIKE '%gen_salt(%')
     AND p.prokind = 'f'
     AND NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
       WHERE cfg LIKE 'search_path=%extensions%'
     ))                                                          AS functions_still_unpinned;
