-- Run before deploying the username/full-name split.
-- Works whether or not 20260926_unique_usernames.sql was applied.
-- Preserves display_name (now full name), profile IDs, collections and friendships.
begin;
lock table public.profiles in share row exclusive mode;

-- Remove the OLD restriction on full names. Different people can share a full name.
drop index if exists public.profiles_username_unique;
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key on public.profiles(username);

-- Assign a distinct handle only to accounts without one. Repeat runs preserve handles.
do $$
declare
  person record;
  counter bigint := 1;
  generated_name text;
begin
  for person in select id from public.profiles where username is null order by id loop
    loop
      generated_name := 'kullanici_' || counter;
      counter := counter + 1;
      exit when not exists (select 1 from public.profiles where username = generated_name);
    end loop;
    update public.profiles set username = generated_name where id = person.id;
  end loop;
end;
$$;

alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z][a-z0-9_.]{2,29}$');

-- Normalize direct API writes too. Do not silently strip spaces or punctuation.
create or replace function public.normalize_profile_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.username := translate(new.username, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
  return new;
end;
$$;
drop trigger if exists normalize_profile_username on public.profiles;
create trigger normalize_profile_username before insert or update of username on public.profiles
  for each row execute function public.normalize_profile_username();

create or replace function public.is_username_available(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    translate(candidate, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') ~ '^[a-z][a-z0-9_.]{2,29}$'
    and not exists (
      select 1 from public.profiles where username = translate(candidate, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')
    ), false);
$$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_name text := new.raw_user_meta_data->>'username';
  inserted_id uuid;
begin
  if requested_name is not null then
    -- Explicit signup names must be valid and unique; never silently rename them.
    insert into public.profiles(id, display_name, username, avatar_emoji)
    values (new.id,
      coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Kullanıcı'),
      requested_name,
      coalesce(new.raw_user_meta_data->>'avatar_emoji', '📖'));
  else
    -- Dashboard-created accounts and old clients do not send username metadata.
    loop
      requested_name := 'kullanici_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
      insert into public.profiles(id, display_name, username, avatar_emoji)
      values (new.id,
        coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Kullanıcı'),
        requested_name,
        coalesce(new.raw_user_meta_data->>'avatar_emoji', '📖'))
      on conflict (username) do nothing returning id into inserted_id;
      exit when inserted_id is not null;
    end loop;
  end if;
  return new;
end;
$$;
commit;
