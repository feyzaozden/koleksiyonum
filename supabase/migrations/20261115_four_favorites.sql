-- Run after 20261114_profile_featured.sql (or category_favorites). Existing selections are preserved; new additions are limited to four total.
begin;
create or replace function public.set_item_featured(target_item bigint, featured boolean)
returns public.items language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); saved public.items;
begin
  if actor is null or featured is null then raise exception 'Geçersiz işlem.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 1729));
  select * into saved from public.items where id=target_item and user_id=actor for update;
  if not found then raise exception 'İçerik bulunamadı veya sana ait değil.'; end if;
  if featured and saved.category not in ('kitap','film','dizi','muzik') then raise exception 'Bu kategori favorilere eklenemez.'; end if;
  if featured and saved.featured_at is null and (select count(*) from public.items where user_id=actor and featured_at is not null)>=4 then
    raise exception 'En fazla 4 favori seçebilirsin. Önce birini kaldır.';
  end if;
  update public.items set featured_at=case when featured then coalesce(featured_at,clock_timestamp()) else null end
    where id=target_item and user_id=actor returning * into saved;
  return saved;
end;
$$;
revoke all on function public.set_item_featured(bigint,boolean) from public,anon;
grant execute on function public.set_item_featured(bigint,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
