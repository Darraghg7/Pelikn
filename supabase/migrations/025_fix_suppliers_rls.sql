-- Migration 025: Fix suppliers table — RLS insert policy + dry_goods constraint

-- Drop the broken check constraint and re-add it with the correct value
-- (category was 'dry_goods' in DB but UI sends 'dry goods' with a space — align to underscore)
alter table suppliers
  drop constraint if exists suppliers_category_check;

alter table suppliers
  add constraint suppliers_category_check
  check (category in ('meat', 'fish', 'dairy', 'produce', 'dry_goods', 'other'));

-- Add a permissive INSERT + UPDATE policy so authenticated clients can write rows
-- The existing "suppliers_venue_access" USING policy only covers SELECT/UPDATE/DELETE row
-- filtering; it does NOT cover INSERT. We add an explicit insert policy here.
create policy "suppliers_insert"
  on suppliers
  for insert
  with check (true);

create policy "suppliers_update"
  on suppliers
  for update
  using (true)
  with check (true);

-- Same fix for noticeboard_posts which has the identical pattern
create policy "noticeboard_insert"
  on noticeboard_posts
  for insert
  with check (true);

create policy "noticeboard_update"
  on noticeboard_posts
  for update
  using (true)
  with check (true);
