-- Tapd In: guest groups + per-entry visibility
-- Run this in the Supabase SQL editor after 0008_phase_status.sql.

create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.guest_groups enable row level security;

create policy "Owners manage groups on their own calendars"
  on public.guest_groups for all
  using (
    exists (
      select 1 from public.calendars
      where calendars.id = guest_groups.calendar_id
      and calendars.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.calendars
      where calendars.id = guest_groups.calendar_id
      and calendars.owner_id = auth.uid()
    )
  );

-- A guest belongs to at most one group. Deleting a group just ungroups them.
alter table public.guest_links
  add column group_id uuid references public.guest_groups(id) on delete set null;

-- null = visible to everyone on the calendar (the existing behavior).
-- A non-null array restricts the entry to guests in those groups (the Owner
-- always sees everything). Stored as an array rather than a join table on
-- purpose: deleting a group leaves a stale id behind, so the entry stays
-- private instead of silently becoming visible to everyone.
alter table public.entries
  add column visible_group_ids uuid[];
