-- Tapd In: record what each message cost to process, so usage-based pricing can
-- be worked out per account. Run in the Supabase SQL editor after
-- 0017_inbox.sql, and BEFORE deploying the code that writes these columns.
-- Purely additive.

alter table public.inbox_messages
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  -- Estimated AI cost in millionths of a dollar (1,000,000 = $1).
  add column if not exists cost_micros integer;
