-- Tapd In: names for phone numbers that texts come from. When the phone sends a
-- number instead of a name, the owner names it once and every text from that
-- number shows the name. Run in the Supabase SQL editor after
-- 0020_inbox_connections.sql. Purely additive.

create table if not exists public.inbox_text_names (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  -- Normalized phone number (digits only, no leading 1 for US numbers).
  handle text not null check (char_length(handle) between 5 and 120),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (owner_id, handle)
);

alter table public.inbox_text_names enable row level security;

create policy "owners manage own text names"
  on public.inbox_text_names for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
