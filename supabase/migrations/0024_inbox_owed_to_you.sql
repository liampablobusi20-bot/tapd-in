-- Tapd In: "Owed to you". What others promised the owner. Run in the Supabase SQL
-- editor after 0023_inbox_waiting_on_you.sql. Purely additive.

alter table public.inbox_messages
  -- What the sender said they would do for the owner, in a few words.
  add column if not exists promise text,
  -- When they said it would be done, if a date was given or clearly implied.
  add column if not exists promise_due date,
  -- The owner got it (or no longer cares).
  add column if not exists promise_resolved_at timestamptz;

create index if not exists inbox_messages_promises
  on public.inbox_messages (owner_id, promise_due)
  where promise is not null and promise_resolved_at is null;
