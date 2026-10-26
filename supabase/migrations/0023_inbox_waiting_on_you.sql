-- Tapd In: "Waiting on you". Run in the Supabase SQL editor after
-- 0022_inbox_text_people.sql. Purely additive.

alter table public.inbox_messages
  -- The sender is clearly waiting on the owner for an answer, decision or action.
  add column if not exists needs_reply boolean not null default false,
  -- The owner marked it done.
  add column if not exists resolved_at timestamptz,
  -- Outlook conversation id, used to tell whether the owner has replied.
  add column if not exists conversation_id text,
  -- The owner replied (seen in Outlook's Sent Items). Only a date is read from there.
  add column if not exists answered_at timestamptz;

create index if not exists inbox_messages_waiting
  on public.inbox_messages (owner_id, received_at)
  where needs_reply and resolved_at is null and answered_at is null;

create index if not exists inbox_messages_conversation
  on public.inbox_messages (owner_id, conversation_id)
  where conversation_id is not null;
