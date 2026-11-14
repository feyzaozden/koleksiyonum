-- Run after 20261113_music.sql. Existing songs and playlists are preserved.
begin;
alter table public.music_playlists add column if not exists description text not null default '';
alter table public.music_playlists add column if not exists cover_path text;
alter table public.profiles add column if not exists music_description text not null default '';
alter table public.profiles add column if not exists music_cover_path text;
alter table public.music_playlists drop constraint if exists playlist_cover_owner;
alter table public.music_playlists add constraint playlist_cover_owner check (cover_path is null or (split_part(cover_path,'/',1)=user_id::text and cover_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'));
alter table public.profiles drop constraint if exists library_cover_owner;
alter table public.profiles add constraint library_cover_owner check (music_cover_path is null or (split_part(music_cover_path,'/',1)=id::text and music_cover_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'));
grant update(description,cover_path) on public.music_playlists to authenticated;
grant update(music_description,music_cover_path) on public.profiles to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('music-covers','music-covers',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists music_covers_read on storage.objects;
create policy music_covers_read on storage.objects for select to authenticated using (
 bucket_id='music-covers' and (
 split_part(name,'/',1)=auth.uid()::text or exists(select 1 from public.profiles p where p.id::text=split_part(name,'/',1) and p.is_public)
 or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.recipient_id::text=split_part(name,'/',1)) or (f.recipient_id=auth.uid() and f.requester_id::text=split_part(name,'/',1))))
));
drop policy if exists music_covers_insert on storage.objects;
create policy music_covers_insert on storage.objects for insert to authenticated with check(bucket_id='music-covers' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists music_covers_delete on storage.objects;
create policy music_covers_delete on storage.objects for delete to authenticated using(bucket_id='music-covers' and split_part(name,'/',1)=auth.uid()::text);
notify pgrst,'reload schema';
commit;
