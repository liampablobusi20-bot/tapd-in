-- Tapd In: temporarily lift the free-plan calendar limit for beta testers
-- Run this in the Supabase SQL editor.
--
-- The billing gate itself (see createCalendar() in
-- src/lib/actions/calendars.ts) stays in the code untouched — it only
-- limits users whose `plan` is 'free'. Defaulting new signups to 'pro'
-- and updating existing ones means nobody hits that limit right now.
-- To re-enable the free tier later (once real billing exists), just flip
-- the default back to 'free' and downgrade users via your Stripe webhook.

alter table public.users alter column plan set default 'pro';

update public.users set plan = 'pro' where plan = 'free';
