-- SUPERSEDED: Do not run this file for the new username/full-name model.
-- Run 20260927_profile_usernames.sql instead (also works if this already ran).
-- Historical migration: Existing names and collections are not changed.
-- If duplicate names exist, this transaction fails without applying changes.
begin;
do $$
begin
  if exists (
    select 1 from public.profiles group by lower(btrim(display_name)) having count(*) > 1
  ) then
    raise exception 'Aynı kullanıcı adını kullanan hesaplar var. Önce çakışan adları değiştirin; hiçbir kayıt değiştirilmedi.';
  end if;
end;
$$;
create unique index if not exists profiles_username_unique
  on public.profiles (lower(btrim(display_name)));

-- Only availability is exposed to the signup form, never profile rows or emails.
create or replace function public.is_username_available(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select candidate is not null and char_length(btrim(candidate)) between 1 and 20
    and not exists (
      select 1 from public.profiles where lower(btrim(display_name)) = lower(btrim(candidate))
    );
$$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
commit;

-- To inspect conflicts BEFORE running this migration (read-only):
-- select lower(btrim(display_name)) as username, count(*)
-- from public.profiles group by lower(btrim(display_name)) having count(*) > 1;
