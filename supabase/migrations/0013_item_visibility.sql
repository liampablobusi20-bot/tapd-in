-- Tapd In: per-item visibility by guest group
-- Run this in the Supabase SQL editor after 0012_assistant_usage.sql.
-- null = visible to everyone (the existing behavior). A non-null array limits
-- the item (and its notes) to guests in those groups; the Owner always sees
-- everything. An array rather than a join table on purpose: deleting a group
-- leaves a stale id behind, so the item stays private instead of silently
-- becoming visible to everyone.

alter table public.calendar_items
  add column if not exists visible_group_ids uuid[];
