-- Tapd In: optional urgent alerts (an email when something urgent arrives).
-- Run in the Supabase SQL editor after 0028_activity_retention_two_step.sql, in a new
-- blank tab. Purely additive. Off for everyone until they turn it on.

alter table public.users
  add column if not exists urgent_alerts boolean not null default false;

-- When an urgent message was emailed about, so it is never alerted twice.
alter table public.inbox_messages
  add column if not exists alerted_at timestamptz;

create index if not exists inbox_messages_urgent_unalerted
  on public.inbox_messages (owner_id)
  where importance = 'urgent' and alerted_at is null;
