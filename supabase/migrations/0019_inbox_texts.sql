-- Tapd In: text messages. Texts come from a small helper on the person's own
-- Mac, and only from contacts they have chosen. Run in the Supabase SQL editor
-- after 0018_inbox_usage.sql. Purely additive.

-- Contacts whose texts may be read. Nothing is read from anyone not on this list.
create table if not exists public.inbox_text_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Normalized phone number (digits only, no leading 1 for US numbers) or a
  -- lowercase email address.
  handle text not null check (char_length(handle) between 5 and 120),
  created_at timestamptz not null default now(),
  unique (owner_id, handle)
);

-- One key per connected device. Only a hash is stored, so a key can be shown
-- once when it is made and never again.
create table if not exists public.inbox_text_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  label text not null default 'My Mac',
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists inbox_text_keys_owner on public.inbox_text_keys (owner_id);

alter table public.inbox_text_contacts enable row level security;
alter table public.inbox_text_keys enable row level security;

create policy "owners manage own text contacts"
  on public.inbox_text_contacts for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Owners can list their keys; keys are created and revoked by the server.
create policy "owners read own text keys"
  on public.inbox_text_keys for select
  using (owner_id = auth.uid());
