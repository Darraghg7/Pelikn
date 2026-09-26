-- Rollback for 134_departments_on_staff_and_tasks.sql.
-- role_id was left untouched by 134, so the previous app code keeps working
-- once these columns are gone.
ALTER TABLE cleaning_tasks DROP COLUMN IF EXISTS department_id;
ALTER TABLE task_templates DROP COLUMN IF EXISTS department_id;
ALTER TABLE task_one_offs  DROP COLUMN IF EXISTS department_id;
DROP TABLE IF EXISTS staff_departments;
