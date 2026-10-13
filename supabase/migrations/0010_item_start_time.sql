-- Tapd In: optional time of day on calendar items
-- Run this in the Supabase SQL editor after 0009_guest_groups_visibility.sql.

alter table public.calendar_items
  add column start_time time;
