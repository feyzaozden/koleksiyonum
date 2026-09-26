-- Adds profile photos without removing profiles, collections or friendships.
begin;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_owner;
alter table public.profiles add constraint profiles_avatar_path_owner check (
  avatar_path is null or (
    split_part(avatar_path, '/', 1) = id::text
    and avatar_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_read" on storage.objects;
create policy "profile_photos_read" on storage.objects for select to authenticated
using (bucket_id = 'profile-photos');
drop policy if exists "profile_photos_insert" on storage.objects;
create policy "profile_photos_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "profile_photos_delete" on storage.objects;
create policy "profile_photos_delete" on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
