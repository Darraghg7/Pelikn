-- ============================================================================
-- 134: Departments go directly on people, and on cleaning tasks and Tasks
--
-- The model, per person: an access level (staff/manager/owner — what they can
-- do) and the departments they work in (ticked on the person — what they
-- see). Job titles (venue_roles) are only a label for the rota and display;
-- they no longer decide visibility, and roles no longer need filing into
-- departments. Cleaning tasks, task templates and one-off tasks are assigned
-- to a department, as opening/closing checks already are (109). A person with
-- no department sees every department.
--
-- staff_departments links a person to the departments they work in.
-- Backfilled from today's role → department setup, so everyone keeps seeing
-- what they saw before.
--
-- cleaning_tasks / task_templates / task_one_offs gain a nullable
-- department_id. NULL = every staff member (fail-open), and deleting a
-- department sets it back to NULL rather than hiding anything.
--
-- Backfill, in order, only where department_id is still NULL:
--   1. From the row's role_id (108) → that role's department.
--   2. From the legacy free-text slug (assigned_role / job_role) when it
--      names one of the venue's departments exactly, ignoring case and
--      underscores. This recovers rows 108 couldn't resolve — e.g. NOMAD's
--      cleaning tasks stored as "kitchen" while its role list said "Chef",
--      which has a "Kitchen" department. No partial or fuzzy matching:
--      anything else stays NULL (visible to everyone), never a guess.
--
-- role_id / assigned_role / job_role stay in place, unused by app code after
-- this ships, as a rollback path.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_departments (
  staff_id      uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_departments_venue ON staff_departments (venue_id);

-- Same scoping as departments (107).
ALTER TABLE staff_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_departments_venue_access ON staff_departments
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

INSERT INTO staff_departments (staff_id, department_id, venue_id)
SELECT DISTINCT a.staff_id, r.department_id, r.venue_id
  FROM staff_role_assignments a
  JOIN venue_roles r ON r.id = a.role_id
 WHERE r.department_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE cleaning_tasks
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE task_one_offs
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN cleaning_tasks.department_id IS 'Supersedes role_id. NULL = every staff member, fail-open.';
COMMENT ON COLUMN task_templates.department_id IS 'Supersedes role_id. NULL = every staff member, fail-open.';
COMMENT ON COLUMN task_one_offs.department_id  IS 'Supersedes role_id. NULL = every staff member, fail-open.';

-- 1. role_id → the role's department
UPDATE cleaning_tasks t SET department_id = r.department_id
  FROM venue_roles r
 WHERE t.department_id IS NULL AND t.role_id = r.id AND r.department_id IS NOT NULL;

UPDATE task_templates t SET department_id = r.department_id
  FROM venue_roles r
 WHERE t.department_id IS NULL AND t.role_id = r.id AND r.department_id IS NOT NULL;

UPDATE task_one_offs t SET department_id = r.department_id
  FROM venue_roles r
 WHERE t.department_id IS NULL AND t.role_id = r.id AND r.department_id IS NOT NULL;

-- 2. legacy slug that exactly names a department of the same venue
UPDATE cleaning_tasks t SET department_id = d.id
  FROM departments d
 WHERE t.department_id IS NULL
   AND t.assigned_role IS NOT NULL
   AND d.venue_id = t.venue_id
   AND lower(d.name) = lower(replace(t.assigned_role, '_', ' '));

UPDATE task_templates t SET department_id = d.id
  FROM departments d
 WHERE t.department_id IS NULL
   AND t.job_role IS NOT NULL
   AND d.venue_id = t.venue_id
   AND lower(d.name) = lower(replace(t.job_role, '_', ' '));

UPDATE task_one_offs t SET department_id = d.id
  FROM departments d
 WHERE t.department_id IS NULL
   AND t.job_role IS NOT NULL
   AND d.venue_id = t.venue_id
   AND lower(d.name) = lower(replace(t.job_role, '_', ' '));
