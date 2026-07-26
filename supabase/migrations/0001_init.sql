-- Tapd In: initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) once you've
-- created your project and wired NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.

-- ── users (Owners only) ─────────────────────────────────────────────
-- One row per Supabase Auth user, created automatically on signup.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'founding_local')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Owners can read their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Owners can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── calendars (one per project) ─────────────────────────────────────
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.calendars enable row level security;

create policy "Owners manage their own calendars"
  on public.calendars for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── calendar_items (phases/dates within a calendar) ─────────────────
create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  label text not null,
  target_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_items enable row level security;

create policy "Owners manage items on their own calendars"
  on public.calendar_items for all
  using (
    exists (
      select 1 from public.calendars
      where calendars.id = calendar_items.calendar_id
      and calendars.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.calendars
      where calendars.id = calendar_items.calendar_id
      and calendars.owner_id = auth.uid()
    )
  );

-- ── entries (comments + photos attached to a calendar_item) ─────────
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  calendar_item_id uuid not null references public.calendar_items(id) on delete cascade,
  author_type text not null check (author_type in ('owner', 'guest')),
  author_label text,
  body_text text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "Owners manage entries on their own calendars"
  on public.entries for all
  using (
    exists (
      select 1 from public.calendar_items
      join public.calendars on calendars.id = calendar_items.calendar_id
      where calendar_items.id = entries.calendar_item_id
      and calendars.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.calendar_items
      join public.calendars on calendars.id = calendar_items.calendar_id
      where calendar_items.id = entries.calendar_item_id
      and calendars.owner_id = auth.uid()
    )
  );

-- Guest read/write on entries happens through a server-side route using
-- the service role (token-gated), not through this policy — see
-- guest_links below and the /c/[token] routes built in a later step.

-- ── guest_links ───────────────────────────────────────────────────
create table public.guest_links (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  token text not null unique,
  permission text not null check (permission in ('view', 'comment')),
  contact_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.guest_links enable row level security;

create policy "Owners manage guest links on their own calendars"
  on public.guest_links for all
  using (
    exists (
      select 1 from public.calendars
      where calendars.id = guest_links.calendar_id
      and calendars.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.calendars
      where calendars.id = guest_links.calendar_id
      and calendars.owner_id = auth.uid()
    )
  );

-- ── contacts (Owner's reusable address book) ─────────────────────────
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text,
  phone text,
  email text,
  last_invited_at timestamptz
);

alter table public.contacts enable row level security;

create policy "Owners manage their own contacts"
  on public.contacts for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
