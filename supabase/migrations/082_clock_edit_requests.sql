-- clock_edit_requests
-- Stores staff-initiated requests to correct their clock-in/out times.
-- Edits are NOT applied until a manager approves them.

create table if not exists clock_edit_requests (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references venues(id) on delete cascade,
  staff_id         uuid not null references staff(id) on delete cascade,
  clock_in_id      uuid references clock_events(id) on delete set null,
  clock_out_id     uuid references clock_events(id) on delete set null,
  original_clock_in  timestamptz,
  original_clock_out timestamptz,
  requested_clock_in  timestamptz not null,
  requested_clock_out timestamptz,
  break_minutes    integer not null default 0,
  reason           text,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'denied')),
  reviewed_by      uuid references staff(id) on delete set null,
  reviewed_at      timestamptz,
  manager_note     text,
  created_at       timestamptz not null default now()
);

-- Index for the manager approval query (pending requests for a venue)
create index if not exists clock_edit_requests_venue_status
  on clock_edit_requests (venue_id, status, created_at desc);

-- Index for staff to look up their own pending requests
create index if not exists clock_edit_requests_staff
  on clock_edit_requests (staff_id, status, created_at desc);

-- RLS: venue members can see their own requests; managers can see all for their venue
alter table clock_edit_requests enable row level security;

create policy "staff can insert own requests"
  on clock_edit_requests for insert
  with check (auth.uid()::text = staff_id::text or true);   -- relaxed; tighten per your auth model

create policy "venue members can read"
  on clock_edit_requests for select
  using (true);   -- app-level filtering by venue_id + staff_id

create policy "managers can update status"
  on clock_edit_requests for update
  using (true);

-- RPC: staff submits an edit request (does NOT touch clock_events)
create or replace function submit_clock_edit_request(
  p_venue_id         uuid,
  p_staff_id         uuid,
  p_clock_in_id      uuid,
  p_clock_out_id     uuid,
  p_original_clock_in  timestamptz,
  p_original_clock_out timestamptz,
  p_requested_clock_in  timestamptz,
  p_requested_clock_out timestamptz,
  p_break_minutes    integer,
  p_reason           text default null
) returns uuid
language plpgsql security definer as $$
declare
  v_id uuid;
begin
  -- Cancel any existing pending request for the same clock-in event
  update clock_edit_requests
     set status = 'denied', manager_note = 'Superseded by newer request'
   where clock_in_id = p_clock_in_id
     and status = 'pending';

  insert into clock_edit_requests (
    venue_id, staff_id, clock_in_id, clock_out_id,
    original_clock_in, original_clock_out,
    requested_clock_in, requested_clock_out,
    break_minutes, reason
  ) values (
    p_venue_id, p_staff_id, p_clock_in_id, p_clock_out_id,
    p_original_clock_in, p_original_clock_out,
    p_requested_clock_in, p_requested_clock_out,
    p_break_minutes, p_reason
  ) returning id into v_id;

  return v_id;
end;
$$;

-- RPC: manager approves — applies the edit to clock_events
create or replace function approve_clock_edit_request(
  p_request_id  uuid,
  p_reviewer_id uuid
) returns void
language plpgsql security definer as $$
declare
  r clock_edit_requests%rowtype;
begin
  select * into r from clock_edit_requests where id = p_request_id;
  if not found or r.status <> 'pending' then return; end if;

  -- Apply the edit to clock_events
  if r.clock_in_id is not null then
    update clock_events set occurred_at = r.requested_clock_in
     where id = r.clock_in_id;
  end if;

  if r.clock_out_id is not null and r.requested_clock_out is not null then
    update clock_events set occurred_at = r.requested_clock_out
     where id = r.clock_out_id;
  end if;

  -- Mark approved
  update clock_edit_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id;
end;
$$;

-- RPC: manager denies
create or replace function deny_clock_edit_request(
  p_request_id  uuid,
  p_reviewer_id uuid,
  p_note        text default null
) returns void
language plpgsql security definer as $$
begin
  update clock_edit_requests
     set status = 'denied',
         reviewed_by  = p_reviewer_id,
         reviewed_at  = now(),
         manager_note = p_note
   where id = p_request_id and status = 'pending';
end;
$$;
