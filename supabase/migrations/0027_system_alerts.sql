-- Tapd In: remembers which "something is wrong" alerts were already emailed to
-- the administrator, so one problem doesn't send an email every 15 minutes.
-- Run in the Supabase SQL editor after 0026_security_hardening.sql. Purely additive.

create table if not exists public.system_alerts (
  key text primary key,
  first_sent_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  times_sent integer not null default 1
);

-- Server-only: no policies, so only the service role can read or write it.
alter table public.system_alerts enable row level security;
