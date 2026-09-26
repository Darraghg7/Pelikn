-- Rollback for 131_mock_inspections.sql.
-- WARNING: drops every saved mock inspection result. The client then shows
-- "needs migration 131" on the Mock Inspection page and saves nothing.
DROP TABLE IF EXISTS mock_inspections;
NOTIFY pgrst, 'reload schema';
