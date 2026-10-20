-- Tapd In: connected email accounts (Microsoft 365 / Outlook first). Run in the
-- Supabase SQL editor after 0019_inbox_texts.sql. Purely additive.

-- One row per connected mailbox. The sign-in tokens are stored encrypted. Only
-- the server touches this table (no policies, so owners can't read it directly).
create table if not exists public.inbox_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('microsoft')),
  account_email text not null,
  -- AES-256-GCM encrypted refresh token.
  refresh_token_enc text not null,
  -- How far we have read: only mail received after this is fetched next time.
  synced_through timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, provider, account_email)
);

create index if not exists inbox_connections_active
  on public.inbox_connections (status) where status = 'active';

alter table public.inbox_connections enable row level security;
