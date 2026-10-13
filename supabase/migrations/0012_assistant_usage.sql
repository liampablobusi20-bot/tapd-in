-- Tapd In: AI assistant usage log (powers the per-calendar daily message cap)
-- Run this in the Supabase SQL editor after 0011_calendar_timezone.sql.

create table public.assistant_usage (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  actor text not null check (actor in ('owner', 'guest')),
  created_at timestamptz not null default now()
);

create index assistant_usage_recent
  on public.assistant_usage (calendar_id, actor, created_at desc);

-- No policies on purpose: only the server (service role) reads or writes this.
alter table public.assistant_usage enable row level security;
