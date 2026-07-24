-- ============================================================================
-- 061: Dummy Opening/Closing checks for Darragh's Cafe
-- Run manually in the Supabase SQL Editor (bypasses RLS as the editor's role).
-- Safe to re-run: skips if this venue already has any opening/closing checks.
-- ============================================================================

DO $$
DECLARE
  v_venue_id uuid := '88ce9330-8f40-4ecc-ba78-9ce29fc01ab7'; -- darraghs-cafe
BEGIN
  IF EXISTS (SELECT 1 FROM opening_closing_checks WHERE venue_id = v_venue_id) THEN
    RAISE NOTICE 'Darragh''s Cafe already has opening/closing checks — skipping.';
    RETURN;
  END IF;

  INSERT INTO opening_closing_checks (title, type, sort_order, venue_id) VALUES
    ('Check fridge and freezer temperatures',   'opening', 0, v_venue_id),
    ('Check hot water is working',              'opening', 1, v_venue_id),
    ('Check floors are clean and dry',          'opening', 2, v_venue_id),
    ('First aid kit and fire exits checked',    'opening', 3, v_venue_id),
    ('Check PM temps recorded',                 'closing', 0, v_venue_id),
    ('Check all daily cleaning completed',      'closing', 1, v_venue_id),
    ('Check all food covered and labelled',     'closing', 2, v_venue_id),
    ('Food on its use by date is discarded',    'closing', 3, v_venue_id);
END $$;
