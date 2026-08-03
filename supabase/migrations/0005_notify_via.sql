-- Tapd In: guest notification channel preference
-- Run this in the Supabase SQL editor after 0004_beta_unlimited_plan.sql.

alter table public.guest_links
  add column notify_via text check (notify_via in ('email', 'sms'));
