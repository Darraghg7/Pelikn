-- ============================================================================
-- 133: fridge check reminder — use UK time, not UTC
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. No client change depends on it. ║
-- ║  Replaces one function; the every-minute cron job (047) keeps calling it ║
-- ║  by name, so nothing needs rescheduling. ROLLBACK: 133_rollback.sql.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Managers set fridge_check_time in Settings as a wall-clock time ("10:00"),
-- meaning UK time. 047 compared it against the UTC clock, so during British
-- Summer Time the reminder arrived an hour late (10:00 fired at 11:00 BST).
--
-- "Logged today" had the same problem: current_date is the UTC date, so
-- between midnight and 01:00 BST it was still yesterday, and a temperature
-- logged in that hour counted towards the wrong day.
--
-- Both now use Europe/London, which follows BST/GMT automatically — the same
-- zone the client uses (lib/time.js londonToday). Everything else is 047's
-- logic unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION send_fridge_check_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          record;
  london_now   timestamp   := now() AT TIME ZONE 'Europe/London';
  cur_time     text        := to_char(london_now, 'HH24:MI');
  today_start  timestamptz := date_trunc('day', london_now) AT TIME ZONE 'Europe/London';
  today_end    timestamptz := (date_trunc('day', london_now) + interval '1 day') AT TIME ZONE 'Europe/London';
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
    -- Only fire when the current UK minute matches the configured time
    CONTINUE WHEN rec.check_time IS NULL OR rec.check_time <> cur_time;

    -- Skip if any fridge temp has been logged today (UK day) for this venue
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM fridge_temperature_logs
      WHERE venue_id = rec.venue_id
        AND logged_at >= today_start
        AND logged_at <  today_end
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
