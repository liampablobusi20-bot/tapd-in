-- Tapd In: activity log, automatic expiry of old summaries, and database-level
-- enforcement of two-step sign-in. Run in the Supabase SQL editor after
-- 0027_system_alerts.sql, in a new blank tab. Purely additive.

-- 1. How long to keep a person's summaries. Owners choose 90, 180 or 365 days.
-- Changed only through the server, so it is not part of the browser's column grant.
alter table public.users
  add column if not exists retention_days integer not null default 180
  check (retention_days in (90, 180, 365));

-- 2. A record of important things that happened on an account. Holds no message
-- content: only what happened and, for a sign-in, which kind of device.
create table if not exists public.inbox_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists inbox_activity_owner on public.inbox_activity (owner_id, created_at desc);
alter table public.inbox_activity enable row level security;
drop policy if exists "Owners read their own activity" on public.inbox_activity;
create policy "Owners read their own activity" on public.inbox_activity
  for select using (owner_id = auth.uid());
-- No insert, update or delete policies: only the server (service role) writes here.

-- 3. Two-step sign-in, enforced in the database. The app also sends people to a
-- code screen, but that alone could be skipped by someone talking to the database
-- API directly with a stolen password. This makes the database itself refuse.
-- A person with no two-step factor is unaffected.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = auth.uid() and status = 'verified'
      );
$$;
revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'inbox_categories', 'inbox_messages', 'inbox_text_contacts', 'inbox_text_keys',
    'inbox_text_names', 'inbox_text_suggestions', 'inbox_activity',
    -- tables from the retired calendar app, until their data is cleaned up
    'calendars', 'calendar_items', 'entries', 'guest_links', 'contacts'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "Two-step sign-in required" on public.%I', t);
      execute format(
        'create policy "Two-step sign-in required" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))',
        t
      );
    end if;
  end loop;
end $$;
