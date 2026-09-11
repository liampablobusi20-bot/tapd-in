-- Tapd In: track progress status per phase
-- Run this in the Supabase SQL editor after 0007_file_attachments.sql.

alter table public.calendar_items
  add column status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'done', 'delayed'));
