-- Tapd In: replies to a specific comment.
-- Run this in the Supabase SQL editor after 0015_private_photos.sql.
-- A reply points at the comment it answers. Deleting a comment deletes its replies.

alter table public.entries
  add column if not exists reply_to uuid references public.entries(id) on delete cascade;

create index if not exists entries_reply_to_idx
  on public.entries (reply_to)
  where reply_to is not null;
