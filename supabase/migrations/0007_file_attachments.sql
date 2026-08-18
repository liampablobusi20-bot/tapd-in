-- Tapd In: allow generic file attachments (documents), not just image/video
-- Run this in the Supabase SQL editor after 0006_onboarding.sql.

alter table public.entries drop constraint entries_media_type_check;
alter table public.entries
  add constraint entries_media_type_check check (media_type in ('image', 'video', 'file'));
