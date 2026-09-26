-- ============================================================================
-- 128: tip_allocations — venue-scoped RLS (tips have never saved)
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Prereqs: 085 (is_venue_hr_manager)║
-- ║  and 091 (has_venue_access). ROLLBACK: 128_rollback.sql.                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- tip_allocations has no venue_id column, so 091's _pk_scope() skipped it and
-- 068's policies stayed live:
--   tip_allocations_read  USING (true)                       — anyone, any venue
--   tip_allocations_write … venues.owner_id = auth.uid()     — Supabase-Auth only
-- A PIN-signed-in manager has no auth.uid() owner match, so every insert fails
-- with 42501 "new row violates row-level security policy". Found in the manual
-- E2E run on 25 Sep 2026: the tip_splits row saves (091 scoped that table),
-- the allocations are rejected, and tip_allocations held 0 rows live.
-- The open read policy also let the anon key read every venue's per-person tip
-- amounts (empty so far only because nothing could be written).
--
-- Fix: scope through the parent split's venue. Reading follows venue
-- membership (has_venue_access, same as tip_splits); writing is manager/owner
-- only (is_venue_hr_manager) — allocations are who-gets-paid-what.
--
-- Idempotent: drops every policy on the table name-agnostically, then creates.
-- No data is changed.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'tip_allocations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tip_allocations', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "tip_allocations_select" ON tip_allocations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM tip_splits ts
    WHERE ts.id = tip_allocations.tip_split_id AND has_venue_access(ts.venue_id)
  ));

CREATE POLICY "tip_allocations_insert" ON tip_allocations
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM tip_splits ts
    WHERE ts.id = tip_allocations.tip_split_id AND is_venue_hr_manager(ts.venue_id)
  ));

CREATE POLICY "tip_allocations_update" ON tip_allocations
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tip_splits ts
    WHERE ts.id = tip_allocations.tip_split_id AND is_venue_hr_manager(ts.venue_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tip_splits ts
    WHERE ts.id = tip_allocations.tip_split_id AND is_venue_hr_manager(ts.venue_id)
  ));

CREATE POLICY "tip_allocations_delete" ON tip_allocations
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM tip_splits ts
    WHERE ts.id = tip_allocations.tip_split_id AND is_venue_hr_manager(ts.venue_id)
  ));

ALTER TABLE tip_allocations ENABLE ROW LEVEL SECURITY;
