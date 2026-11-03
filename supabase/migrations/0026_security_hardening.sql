-- Tapd In: security hardening. Run in the Supabase SQL editor after
-- 0025_inbox_calendar.sql, in a new blank tab.

-- 1. A signed-in user could update ANY column of their own users row, including
-- plan, subscription_status and inbox_enabled. Limit what the browser login can
-- change to the two things the app lets people edit. The server (service role)
-- is unaffected.
revoke update on public.users from anon, authenticated;
grant update (display_name, text_suggestions) on public.users to authenticated;

-- 2. Subject lines are now removed as soon as a message is summarized, like its
-- text. Clear the ones already stored (messages still waiting to be summarized
-- keep theirs until they are).
update public.inbox_messages set subject = null where subject is not null and status <> 'pending';
