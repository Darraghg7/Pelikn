-- ============================================================================
-- 109: Department-scoped Opening & Closing checks (Phase 1)
--
-- opening_closing_checks gains a nullable department_id — NULL means
-- "visible to everyone" (fail-open), same rule as venue_roles.department_id
-- from 107. Existing checks are untouched by this migration: every check a
-- venue already has stays visible to all staff until a manager explicitly
-- assigns it to a department.
-- ============================================================================

ALTER TABLE opening_closing_checks
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN opening_closing_checks.department_id IS
  'NULL = visible to every staff member (fail-open). Set via Settings → Roles → Departments.';
