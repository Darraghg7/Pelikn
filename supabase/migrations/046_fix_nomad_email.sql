-- Revert Nomad manager_email to nomad.bakes1@gmail.com
-- Fix demo venue manager_email (was incorrectly set to darraghguy1@gmail.com in 043)

-- Nomad Café
UPDATE app_settings
SET value = '"nomad.bakes1@gmail.com"'
WHERE venue_id = '00000000-0000-0000-0000-000000000001'
  AND key = 'manager_email';

-- Demo venues (brew-and-bloom, the-corner-cup) — update if they exist
UPDATE app_settings
SET value = '"demo@pelikn.app"'
WHERE venue_id IN (
  SELECT id FROM venues WHERE slug IN ('brew-and-bloom', 'the-corner-cup')
)
AND key = 'manager_email';
