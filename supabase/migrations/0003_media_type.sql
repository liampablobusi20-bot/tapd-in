-- Tapd In: video support for entries
-- Run this in the Supabase SQL editor after 0001_init.sql and 0002_storage.sql.

-- Existing rows keep media_type = null, which the app treats as 'image'
-- (they were all photos before this column existed).
alter table public.entries
  add column media_type text check (media_type in ('image', 'video'));
