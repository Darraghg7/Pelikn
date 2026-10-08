-- ============================================================================
-- 143 ROLLBACK: remove the `extras` list from every venue's 'features' setting
--
-- APPLY MANUALLY IN SUPABASE SQL EDITOR. Roll the app change back FIRST:
-- with the new app live and no `extras`, every optional extra is hidden.
--
-- Rows 143 inserted for venues that had no 'features' row are left as
-- {"mode":"all"}, which is what the app assumes when there is no row.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

UPDATE public.app_settings
SET value = (value::jsonb - 'extras')::text
WHERE key = 'features'
  AND value ~ '^\s*\{'
  AND value::jsonb ? 'extras';

COMMIT;
