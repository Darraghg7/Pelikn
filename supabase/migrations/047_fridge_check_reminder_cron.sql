-- ============================================================================
-- 047: Fridge check reminder via pg_cron + pg_net
-- Every minute, find venues whose fridge_check_time matches the current time
-- and where no fridge temps have been logged today — then push managers.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function called by cron every minute
CREATE OR REPLACE FUNCTION send_fridge_check_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec        record;
  venue_time text;
  cur_time   text := to_char(now() AT TIME ZONE 'UTC', 'HH24:MI');
  supabase_url text := current_setting('app.supabase_url', true);
  service_key  text := current_setting('app.service_role_key', true);
BEGIN
  -- Loop over venues that have fridge_check_time set
  FOR rec IN
    SELECT DISTINCT
      s.venue_id,
      replace(s.value, '"', '') AS check_time
    FROM app_settings s
    WHERE s.key = 'fridge_check_time'
  LOOP
    -- Only fire when current UTC minute matches the configured time
    CONTINUE WHEN rec.check_time IS NULL OR rec.check_time <> cur_time;

    -- Skip if any fridge temp has been logged today for this venue
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM fridge_temperature_logs
      WHERE venue_id = rec.venue_id
        AND logged_at >= current_date
        AND logged_at < current_date + 1
    );

    -- Skip if venue has no active fridges
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM fridges WHERE venue_id = rec.venue_id AND is_active = true
    );

    -- Fire push via edge function (fire-and-forget)
    IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body    := jsonb_build_object(
          'venueId', rec.venue_id::text,
          'title',   'Fridge Check Reminder',
          'body',    'No fridge temperatures have been logged yet today.',
          'url',     '/fridge',
          'roles',   jsonb_build_array('manager', 'owner')
        )::text
      );
    END IF;
  END LOOP;
END;
$$;

-- Schedule: run every minute
SELECT cron.schedule(
  'fridge-check-reminder',
  '* * * * *',
  'SELECT send_fridge_check_reminders()'
);
