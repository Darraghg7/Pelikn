-- Fix approve_clock_edit_request: it was written only for "correct an
-- existing punch" and never updated when the "report a missing shift"
-- request type (submit_clock_edit_request with clock_in_id/clock_out_id
-- both null) was added. Two bugs as a result:
--
-- 1. Break-minute corrections were silently dropped — the function only
--    ever updated clock_in/clock_out timestamps, never touched
--    break_start/break_end events. edit_clock_session (the manager
--    direct-edit path) already handles this correctly; mirror it here.
-- 2. "Missing shift" approvals did nothing at all — clock_in_id is null
--    for that request type, so the `if r.clock_in_id is not null` guard
--    skipped the whole insert. The request was marked approved but no
--    clock_events rows were ever created, so the hours never appeared
--    on the manager's timesheet.
create or replace function approve_clock_edit_request(
  p_request_id  uuid,
  p_reviewer_id uuid
) returns void
language plpgsql security definer as $$
declare
  r           clock_edit_requests%rowtype;
  v_break_mid timestamptz;
begin
  select * into r from clock_edit_requests where id = p_request_id;
  if not found or r.status <> 'pending' then return; end if;

  -- Apply the clock-in event: update the existing one, or insert a brand
  -- new one when there was no prior clock_events row at all.
  if r.clock_in_id is not null then
    update clock_events set occurred_at = r.requested_clock_in
     where id = r.clock_in_id;
  else
    insert into clock_events (staff_id, venue_id, event_type, occurred_at)
    values (r.staff_id, r.venue_id, 'clock_in', r.requested_clock_in);
  end if;

  -- Apply the clock-out event the same way.
  if r.requested_clock_out is not null then
    if r.clock_out_id is not null then
      update clock_events set occurred_at = r.requested_clock_out
       where id = r.clock_out_id;
    else
      insert into clock_events (staff_id, venue_id, event_type, occurred_at)
      values (r.staff_id, r.venue_id, 'clock_out', r.requested_clock_out);
    end if;
  end if;

  -- Replace any break events inside the session window with the approved
  -- break duration (mirrors edit_clock_session's break handling). Safe to
  -- run unconditionally: for a brand-new "missing shift" session there are
  -- no pre-existing break events in the window, so the delete is a no-op.
  delete from clock_events
   where staff_id   = r.staff_id
     and venue_id   = r.venue_id
     and event_type in ('break_start', 'break_end')
     and occurred_at > r.requested_clock_in
     and occurred_at < coalesce(r.requested_clock_out, r.requested_clock_in + interval '24 hours');

  if r.break_minutes > 0 and r.requested_clock_out is not null then
    v_break_mid := r.requested_clock_in
                 + (r.requested_clock_out - r.requested_clock_in) / 2;
    insert into clock_events (staff_id, venue_id, event_type, occurred_at)
    values
      (r.staff_id, r.venue_id, 'break_start',
       v_break_mid - (r.break_minutes * interval '1 minute') / 2),
      (r.staff_id, r.venue_id, 'break_end',
       v_break_mid + (r.break_minutes * interval '1 minute') / 2);
  end if;

  -- Mark approved
  update clock_edit_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id;
end;
$$;
