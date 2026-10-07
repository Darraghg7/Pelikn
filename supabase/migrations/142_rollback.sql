-- ============================================================================
-- 142 ROLLBACK: put app_settings back to its pre-142 policies
--
-- Restores the shape 091 left (public SELECT for everyone, writes for any
-- venue member) — the state the 1 Oct 2026 audit observed. This REOPENS the
-- table to the anon key, so only use it if 142 broke something.
-- The client still works after rollback: get_public_venue_logo is kept by
-- default so a deployed AllergenPublicPage keeps loading logos. To remove it
-- too, uncomment the DROP FUNCTION line (only after reverting the client).
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.app_settings'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_settings', r.polname);
  END LOOP;
END $$;

CREATE POLICY app_settings_public_read ON public.app_settings
  FOR SELECT USING (true);
CREATE POLICY app_settings_venue_insert ON public.app_settings
  FOR INSERT WITH CHECK (has_venue_access(venue_id));
CREATE POLICY app_settings_venue_update ON public.app_settings
  FOR UPDATE USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));
CREATE POLICY app_settings_venue_delete ON public.app_settings
  FOR DELETE USING (has_venue_access(venue_id));

-- DROP FUNCTION IF EXISTS get_public_venue_logo(text);

COMMIT;
