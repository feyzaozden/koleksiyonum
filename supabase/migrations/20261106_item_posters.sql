-- Additive migration: existing collection records remain unchanged.
begin;
alter table public.items add column if not exists poster_path text;
alter table public.items drop constraint if exists items_poster_path_valid;
alter table public.items add constraint items_poster_path_valid
  check (poster_path is null or poster_path ~ '^/[a-zA-Z0-9_-]+\.(jpg|png|webp)$');
notify pgrst, 'reload schema';
commit;
