-- Tapd In: optional meeting briefs. Run in the Supabase SQL editor after
-- 0024_inbox_owed_to_you.sql. Purely additive.

-- Whether the owner has turned on meeting briefs for this mailbox. Off by default.
alter table public.inbox_connections
  add column if not exists calendar_enabled boolean not null default false;
