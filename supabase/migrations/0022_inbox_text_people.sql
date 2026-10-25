-- Tapd In: manage whose texts count inside Tapd In, and optionally suggest new
-- numbers. Run in the Supabase SQL editor after 0021_inbox_text_names.sql.
-- Purely additive.

-- Off by default: the phone tells Tapd In about numbers that aren't on the list
-- only if the owner turns this on.
alter table public.users
  add column if not exists text_suggestions boolean not null default false;

-- Numbers that texted the owner but aren't on their list yet (number only, never
-- the message). The owner taps Add or Ignore.
create table if not exists public.inbox_text_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  handle text not null check (char_length(handle) between 5 and 120),
  status text not null default 'new' check (status in ('new', 'ignored')),
  seen_count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (owner_id, handle)
);

alter table public.inbox_text_suggestions enable row level security;

create policy "owners manage own text suggestions"
  on public.inbox_text_suggestions for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
