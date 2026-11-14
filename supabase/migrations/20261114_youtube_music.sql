-- Run after 20261113_music.sql. Does not modify existing songs.
begin;
alter table public.items add column if not exists youtube_source_id text;
alter table public.items drop constraint if exists items_youtube_source_valid;
alter table public.items add constraint items_youtube_source_valid check (
  youtube_source_id is null or (category='muzik' and youtube_source_id ~ '^[A-Za-z0-9_-]{11}$' and music_recording_id is null)
);
create unique index if not exists items_youtube_source_unique on public.items(user_id,youtube_source_id) where youtube_source_id is not null;
revoke insert(youtube_source_id),update(youtube_source_id) on public.items from public,anon,authenticated;
create or replace function collection_private.guard_youtube_source()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.youtube_source_id is distinct from old.youtube_source_id then raise exception 'YouTube kaynak kimliği değiştirilemez.'; end if;
  return new;
end;
$$;
drop trigger if exists guard_youtube_source on public.items;
create trigger guard_youtube_source before update on public.items for each row execute function collection_private.guard_youtube_source();
notify pgrst,'reload schema';
commit;
