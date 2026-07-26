-- Tapd In: photo storage
-- Run this in the Supabase SQL editor after 0001_init.sql.

-- Public bucket for phase photos. Public so Guests (who never log in) can
-- view photos on a calendar via a plain <img src>.
insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', true)
on conflict (id) do nothing;

-- Objects are stored at entry-photos/{calendar_id}/{calendar_item_id}/{filename}
-- so ownership can be checked from the path alone.

create policy "Owners can upload photos to their own calendars"
on storage.objects for insert
with check (
  bucket_id = 'entry-photos'
  and exists (
    select 1 from public.calendars
    where calendars.id::text = (storage.foldername(storage.objects.name))[1]
    and calendars.owner_id = auth.uid()
  )
);

create policy "Owners can delete photos from their own calendars"
on storage.objects for delete
using (
  bucket_id = 'entry-photos'
  and exists (
    select 1 from public.calendars
    where calendars.id::text = (storage.foldername(storage.objects.name))[1]
    and calendars.owner_id = auth.uid()
  )
);

create policy "Anyone can view entry photos"
on storage.objects for select
using (bucket_id = 'entry-photos');
