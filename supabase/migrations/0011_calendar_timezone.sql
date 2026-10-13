-- Tapd In: per-calendar time zone
-- Run this in the Supabase SQL editor after 0010_item_start_time.sql.
-- null = no time zone set (times are treated as plain clock times).

alter table public.calendars
  add column timezone text;
