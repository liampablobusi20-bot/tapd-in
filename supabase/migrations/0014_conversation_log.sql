-- Tapd In: schedule changes become part of the conversation, batched notifications,
-- and owner notification settings.
-- Run this in the Supabase SQL editor after 0013_item_visibility.sql.

-- 'change' entries are the automatic "Moved from Oct 14 to Oct 17" lines shown
-- in an item's thread alongside people's notes.
alter table public.entries
  add column if not exists kind text not null default 'note'
    check (kind in ('note', 'change'));

-- Owners hear about guest activity by email unless they turn it off, and can
-- choose the name guests see on their notes.
alter table public.users
  add column if not exists notify_email boolean not null default true;
alter table public.users
  add column if not exists display_name text;

-- Changes wait here for a few seconds so a burst of edits becomes one message.
-- Only the server (service role) touches it.
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  message text not null,
  -- null = everyone who can see the calendar; otherwise only these groups.
  audience uuid[],
  -- the guest link that caused it; null = the owner.
  actor_link_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_queue_pending
  on public.notification_queue (calendar_id)
  where sent_at is null;

alter table public.notification_queue enable row level security;
