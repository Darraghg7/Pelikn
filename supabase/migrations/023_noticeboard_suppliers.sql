-- Migration 023: Noticeboard posts + Suppliers tables

-- ── Noticeboard Posts ────────────────────────────────────────────────────────

create table if not exists noticeboard_posts (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  title           text not null,
  body            text,
  pinned          boolean not null default false,
  created_by_name text,
  created_at      timestamptz not null default now()
);

alter table noticeboard_posts enable row level security;

create policy "noticeboard_venue_access"
  on noticeboard_posts
  using (
    venue_id in (
      select id from venues where id = venue_id
    )
  );

-- ── Suppliers ────────────────────────────────────────────────────────────────

create table if not exists suppliers (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references venues(id) on delete cascade,
  name         text not null,
  category     text check (category in ('meat','fish','dairy','produce','dry_goods','other')),
  contact_name text,
  phone        text,
  email        text,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table suppliers enable row level security;

create policy "suppliers_venue_access"
  on suppliers
  using (
    venue_id in (
      select id from venues where id = venue_id
    )
  );
