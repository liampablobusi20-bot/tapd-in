-- Tapd In: two-week trials, billing groundwork, and per-account customization. Run in the Supabase SQL editor
-- after 0029_urgent_alerts.sql, in a new blank tab. Purely additive.

-- When a person's free trial ends. Empty means no trial limit (everyone switched on before
-- this existed stays that way). Their state also uses the existing subscription_status:
-- 'active' = paying, 'canceled' = paused, 'trialing' = on trial or exempt.
alter table public.users add column if not exists trial_ends_at timestamptz;

-- Billing (Stripe). Each account can have its own monthly price, set by the administrator.
alter table public.users add column if not exists monthly_price_cents integer
  check (monthly_price_cents is null or monthly_price_cents between 100 and 5000000);
alter table public.users add column if not exists stripe_customer_id text unique;
alter table public.users add column if not exists stripe_subscription_id text;
-- When a payment first failed (cleared once it is paid), to count the grace period from.
alter table public.users add column if not exists billing_issue_at timestamptz;

-- Stripe events already handled, so a repeated delivery is never applied twice.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- Each account's own settings, changed only through the server. One row per account, so a
-- change for one person can never touch another's.
create table if not exists public.account_config (
  owner_id uuid primary key references public.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Every change, with what it was before, so any change can be undone.
create table if not exists public.account_config_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by text not null,
  note text,
  before jsonb not null,
  after jsonb not null
);
create index if not exists account_config_history_owner on public.account_config_history (owner_id, changed_at desc);

-- Server-only: no policies, so only the service role can read or write them.
alter table public.account_config enable row level security;
alter table public.account_config_history enable row level security;
