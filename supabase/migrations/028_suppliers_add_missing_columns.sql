-- ============================================================================
-- 028: Add missing columns to suppliers table
-- ============================================================================
-- The suppliers table was originally created in migration 012 with only:
--   id, name, is_active, created_at
-- Migration 023 tried to recreate it with additional columns but
-- CREATE TABLE IF NOT EXISTS silently skipped it since the table existed.
-- Migration 027 added the category column. This migration adds the rest.
-- ============================================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone        text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email        text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes        text;
