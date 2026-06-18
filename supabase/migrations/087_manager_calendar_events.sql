-- 087_manager_calendar_events.sql
-- Introduces the manager_calendar_events table.
-- Closed periods previously stored in venue_closures are migrated in as
-- type = 'closed' events so no data is lost.

create table if not exists manager_calendar_events (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references venues(id) on delete cascade,
  created_by       uuid references auth.users(id),
  title            text not null,
  type             text not null default 'event',
  -- 'event' | 'closed' | 'meeting' | 'review' | 'delivery' | 'other'
  colour           text not null default 'forest',
  -- 'forest' | 'rust' | 'ocean' | 'amber' | 'slate' | 'plum'
  start_date       date not null,
  end_date         date not null,
  all_day          boolean not null default true,
  start_time       time,
  end_time         time,
  notes            text,
  reminder_days    int  not null default 1,
  backup_reminder  boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- RLS: only managers/owners of the venue can read or write
alter table manager_calendar_events enable row level security;

create policy "venue managers can manage calendar events"
  on manager_calendar_events
  for all
  using (
    venue_id in (
      select venue_id from venue_members
      where user_id = auth.uid()
        and role in ('manager', 'owner')
    )
  );

-- Migrate existing venue_closures → manager_calendar_events
insert into manager_calendar_events (venue_id, title, type, colour, start_date, end_date, all_day, reminder_days, backup_reminder)
select
  venue_id,
  coalesce(nullif(trim(reason), ''), 'Closed') as title,
  'closed'  as type,
  'rust'    as colour,
  start_date,
  end_date,
  true      as all_day,
  1         as reminder_days,
  false     as backup_reminder
from venue_closures
on conflict do nothing;
