# Venue Data Backups

Use this when Supabase project-level backups are unavailable. It exports the key payroll/rota tables for a venue into timestamped JSON and CSV files under `backups/`.

`backups/` is gitignored because it contains staff and payroll data.

## Run a Nomad Backup

Get the service role key from Supabase:

`Project Settings > API > service_role key`

Put this in `.env.local`:

```sh
SUPABASE_SERVICE_ROLE_KEY=paste-service-role-key-here
```

Then run:

```sh
npm run backup:venue
```

The default venue is Nomad:

`00000000-0000-0000-0000-000000000001`

## What It Exports

- `venues`
- `staff`
- `shifts`
- `clock_events`
- `time_off_requests`
- `shift_swaps`
- `staff_availability`

Each table is written as both `.json` and `.csv`, plus a `manifest.json` with row counts.

## Restore Approach

Do not blindly import a whole backup over live data. For a recovery, compare the missing date range first, then insert only the missing rows back into Supabase.
