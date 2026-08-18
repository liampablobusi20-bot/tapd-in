-- Tapd In: track whether an Owner has completed the first-login walkthrough
-- Run this in the Supabase SQL editor after 0005_notify_via.sql.

alter table public.users
  add column onboarded_at timestamptz;
