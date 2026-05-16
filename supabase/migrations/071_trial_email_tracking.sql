-- Track which trial lifecycle emails have been sent per venue.
-- Stored as an array of day numbers, e.g. {0,2,4} means day 0, 2, 4 sent.
alter table venues
  add column if not exists trial_emails_sent integer[] not null default '{}';
