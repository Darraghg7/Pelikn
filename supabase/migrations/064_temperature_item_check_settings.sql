-- Migration 064: Per-item temperature check settings
-- Lets each fridge/freezer and hot holding item define its own safe range,
-- required days, and required AM/PM check periods.

ALTER TABLE fridges
  ADD COLUMN IF NOT EXISTS check_days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  ADD COLUMN IF NOT EXISTS required_periods text[] NOT NULL DEFAULT ARRAY['am','pm'];

ALTER TABLE hot_holding_items
  ADD COLUMN IF NOT EXISTS min_temp numeric NOT NULL DEFAULT 63,
  ADD COLUMN IF NOT EXISTS max_temp numeric,
  ADD COLUMN IF NOT EXISTS check_days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  ADD COLUMN IF NOT EXISTS required_periods text[] NOT NULL DEFAULT ARRAY['am','pm'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fridges_check_days_valid'
  ) THEN
    ALTER TABLE fridges
      ADD CONSTRAINT fridges_check_days_valid
      CHECK (check_days <@ ARRAY[0,1,2,3,4,5,6]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fridges_required_periods_valid'
  ) THEN
    ALTER TABLE fridges
      ADD CONSTRAINT fridges_required_periods_valid
      CHECK (required_periods <@ ARRAY['am','pm']::text[]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hot_holding_items_check_days_valid'
  ) THEN
    ALTER TABLE hot_holding_items
      ADD CONSTRAINT hot_holding_items_check_days_valid
      CHECK (check_days <@ ARRAY[0,1,2,3,4,5,6]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hot_holding_items_required_periods_valid'
  ) THEN
    ALTER TABLE hot_holding_items
      ADD CONSTRAINT hot_holding_items_required_periods_valid
      CHECK (required_periods <@ ARRAY['am','pm']::text[]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hot_holding_items_temp_range_valid'
  ) THEN
    ALTER TABLE hot_holding_items
      ADD CONSTRAINT hot_holding_items_temp_range_valid
      CHECK (max_temp IS NULL OR min_temp < max_temp);
  END IF;
END $$;
