-- ============================================================================
-- 142: app_settings — venue-scoped read, manager-only write, public logo RPC
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Never `supabase db push`.         ║
-- ║  Prereqs: 091 (has_venue_access), 085 (is_venue_hr_manager), 141.        ║
-- ║  ROLLBACK: 142_rollback.sql (same folder).                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Problem (1 Oct 2026 audit): GET /rest/v1/app_settings?select=* with only
-- the public anon key returned every row for every venue (56 rows, 5 venues).
-- 002 created "settings_public_read" USING (true), and 091 kept app_settings
-- in its public-read group alongside the allergen-menu tables, because the
-- public allergen page (/allergens/:slug) reads the venue's logo_url.
--
-- The table holds manager_email (the owner's personal address — also used by
-- send-weekly-report as the report recipient), venue_name, logo_url, FHRS
-- rating, payroll_locks, rota_published_<week>, features, custom_roles,
-- permission_titles, opening hours and the attendance/closing rules.
--
-- Who reads it (checked 7 Oct 2026):
--   • Pre-sign-in: ONLY AllergenPublicPage → logo_url. The PIN login screen,
--     signup and onboarding read nothing from app_settings before sign-in.
--   • Signed-in members (owner via Supabase Auth, staff via PIN JWT): every
--     other reader, incl. get_app_bootstrap / get_team_status /
--     get_manager_notifications_data (all SECURITY INVOKER — they follow
--     these policies).
--   • Cron/edge functions: send_fridge_check_reminders (SECURITY DEFINER),
--     send-weekly-report (service role) — both bypass RLS, unaffected.
--   • Writers: all UI writes are manager/owner-gated (settings pages are
--     RequireManager; rota publish, payroll lock, onboarding and the
--     Getting Started card check isManager = staff role manager/owner).
--
-- New access model:
--   SELECT  → has_venue_access(venue_id)            (members; demo rule from 141)
--   INSERT/UPDATE/DELETE → has_venue_access(venue_id) AND is_venue_hr_manager(venue_id)
--             (member of the venue AND manager/owner staff or the owner)
--   anon    → nothing from the table; logo via get_public_venue_logo(slug).
--
-- Policies are dropped name-agnostically (as 091 did) because live policy
-- names on this table have drifted from the repo before (002/006/076/078/091).
--
-- Idempotent. Rollback: 142_rollback.sql
-- ============================================================================

BEGIN;

-- app_settings is read on nearly every page load; don't queue behind a long
-- lock and stall the app. If this times out, just run it again.
SET LOCAL lock_timeout = '5s';

-- ── 1. Replace every existing policy on app_settings ────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.app_settings'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_settings', r.polname);
  END LOOP;
END $$;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_venue_read ON public.app_settings
  FOR SELECT
  USING (has_venue_access(venue_id));

CREATE POLICY app_settings_manager_insert ON public.app_settings
  FOR INSERT
  WITH CHECK (has_venue_access(venue_id) AND is_venue_hr_manager(venue_id));

CREATE POLICY app_settings_manager_update ON public.app_settings
  FOR UPDATE
  USING      (has_venue_access(venue_id) AND is_venue_hr_manager(venue_id))
  WITH CHECK (has_venue_access(venue_id) AND is_venue_hr_manager(venue_id));

CREATE POLICY app_settings_manager_delete ON public.app_settings
  FOR DELETE
  USING (has_venue_access(venue_id) AND is_venue_hr_manager(venue_id));

-- ── 2. The one pre-sign-in read: the logo on the public allergen menu ──────
-- Returns logo_url only (or NULL) for the venue with this slug. The logo is a
-- public storage URL already shown on that public page, so nothing new leaks.
CREATE OR REPLACE FUNCTION get_public_venue_logo(p_slug text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.value
  FROM venues v
  JOIN app_settings s ON s.venue_id = v.id AND s.key = 'logo_url'
  WHERE v.slug = p_slug
  LIMIT 1
$$;

COMMENT ON FUNCTION get_public_venue_logo(text) IS
  'Public allergen menu: the venue''s logo_url by slug, nothing else. '
  'app_settings itself is members-only since 142.';

REVOKE ALL ON FUNCTION get_public_venue_logo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_venue_logo(text) TO anon, authenticated;

COMMIT;
