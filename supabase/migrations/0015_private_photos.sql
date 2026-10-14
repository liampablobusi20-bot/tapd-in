-- Tapd In: make uploaded photos/files private.
-- Run this in the Supabase SQL editor ONLY AFTER the app version that serves
-- media through expiring signed links is live. Until then, leave it alone:
-- running it early would break every existing photo.

update storage.buckets
  set public = false
  where id = 'entry-photos';

-- Owners and guests now get short-lived signed links from the server instead
-- of anyone being able to open a photo by its raw address.
drop policy if exists "Anyone can view entry photos" on storage.objects;
