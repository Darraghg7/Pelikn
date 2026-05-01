-- ============================================================================
-- 067: Tighten RLS on duties tables
--
-- Migration 066 left duty_templates, duty_template_items, and duty_assignments
-- with fully open write policies (WITH CHECK (true)), meaning any anon caller
-- with the Supabase URL + anon key could mutate data for any venue.
--
-- Fix: scope ALL writes to authenticated managers who own the target venue.
-- Reads remain open (staff need to load their duties without a JWT).
-- duty_item_completions is unaffected — writes already go through
-- SECURITY DEFINER RPCs (complete_duty_item / uncomplete_duty_item).
-- ============================================================================

-- ── duty_templates ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "duty_templates_write" ON duty_templates;

CREATE POLICY "duty_templates_write" ON duty_templates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM venues WHERE id = duty_templates.venue_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM venues WHERE id = venue_id AND user_id = auth.uid())
  );

-- ── duty_template_items ───────────────────────────────────────────────────────
-- Items belong to templates; scope via the parent template's venue.
DROP POLICY IF EXISTS "duty_template_items_write" ON duty_template_items;

CREATE POLICY "duty_template_items_write" ON duty_template_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM duty_templates dt
      JOIN venues v ON v.id = dt.venue_id
      WHERE dt.id = duty_template_items.duty_template_id
        AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM duty_templates dt
      JOIN venues v ON v.id = dt.venue_id
      WHERE dt.id = duty_template_id
        AND v.user_id = auth.uid()
    )
  );

-- ── duty_assignments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "duty_assignments_write" ON duty_assignments;

CREATE POLICY "duty_assignments_write" ON duty_assignments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM venues WHERE id = duty_assignments.venue_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM venues WHERE id = venue_id AND user_id = auth.uid())
  );
