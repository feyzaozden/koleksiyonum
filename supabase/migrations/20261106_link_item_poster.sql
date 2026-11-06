-- Run after 20261106_item_posters.sql
begin;
create or replace function collection_private.guard_item_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  today date := (clock_timestamp() at time zone 'Europe/Istanbul')::date;
  changed_identity boolean;
  fingerprint text;
  count_used integer;
begin
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.added_at is distinct from old.added_at then
      raise exception 'Kayıt sahibi, kimliği ve eklenme zamanı değiştirilemez.';
    end if;
    if (new.source is distinct from old.source or new.source_id is distinct from old.source_id) and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'Kaynak kimliği sonradan değiştirilemez.';
    end if;
    if old.source_id is not null and new.category is distinct from old.category then
      raise exception 'Kaynakla doğrulanan içeriğin kategorisi değiştirilemez.';
    end if;
  end if;

  if TG_OP = 'INSERT' or new.title is distinct from old.title then
    new.title := btrim(new.title);
    if new.title is null or public.normalize_item_identity(new.title) = '' or char_length(new.title) > 300 or new.title ~ '[[:cntrl:]]' then
      raise exception 'Başlık 1–300 karakter olmalı ve kontrol karakteri içermemeli.';
    end if;
  end if;
  if TG_OP = 'INSERT' or new.creator is distinct from old.creator then
    new.creator := nullif(btrim(new.creator),'');
    if char_length(new.creator) > 300 or new.creator ~ '[[:cntrl:]]' then raise exception 'Yazar/yönetmen bilgisi en fazla 300 karakter olmalı.'; end if;
  end if;
  if TG_OP = 'INSERT' or new.note is distinct from old.note then
    if char_length(new.note) > 3000 then raise exception 'Not en fazla 3000 karakter olmalı.'; end if;
  end if;
  if TG_OP = 'INSERT' or new.emoji is distinct from old.emoji then
    if char_length(new.emoji) > 16 then raise exception 'Geçersiz simge.'; end if;
  end if;
  if TG_OP = 'INSERT' or new.year is distinct from old.year then
    new.year := nullif(btrim(new.year),'');
    if new.year is not null then
      if new.year !~ '^[0-9]{1,4}$' then raise exception 'Geçerli bir yıl gir.'; end if;
      if new.year::integer < 1 or new.year::integer > extract(year from today) then raise exception 'Yıl bu yıldan ileri olamaz.'; end if;
      new.year := new.year::integer::text;
    end if;
  end if;
  if TG_OP = 'INSERT' or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then
    if new.start_date > today or new.end_date > today then raise exception 'Tarih bugünden sonra olamaz.'; end if;
    if new.end_date < new.start_date then raise exception 'Bitiş tarihi başlangıç tarihinden önce olamaz.'; end if;
  end if;

  if TG_OP = 'INSERT' then
    if (new.source is null) <> (new.source_id is null) then raise exception 'Geçersiz kaynak bilgisi.'; end if;
    if new.source is not null and (new.source <> 'tmdb' or new.category not in ('film','dizi') or new.source_id <= 0) then
      raise exception 'Geçersiz kaynak bilgisi.';
    end if;
    if exists (select 1 from collection_private.item_creation_blocks b where b.user_id = new.user_id) then
      raise exception 'Yeni içerik eklemen kısıtlandı. Destek adresiyle iletişime geçebilirsin.';
    end if;
  end if;

  changed_identity := TG_OP = 'INSERT' or new.title is distinct from old.title or new.creator is distinct from old.creator
    or new.year is distinct from old.year or new.category is distinct from old.category
    or new.source is distinct from old.source or new.source_id is distinct from old.source_id;
  if changed_identity then
    -- Serializes identity checks for one account; independent accounts do not block each other.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1729));
    fingerprint := public.item_identity_key(new.title, new.creator, new.year);
    if exists (select 1 from public.items i where i.user_id = new.user_id and i.category = new.category and i.id <> new.id
      and public.item_identity_key(i.title, i.creator, i.year) = fingerprint
      and (new.source_id is null or i.source_id is null or (i.source = new.source and i.source_id = new.source_id))) then
      raise exception using errcode = '23505', message = 'Bu içerik zaten koleksiyonunda. Mevcut kaydı düzenleyebilirsin.';
    end if;
    -- Verified distinct sources can have identical display metadata.
    new.dedupe_key := case when new.source_id is null then fingerprint else 'source:' || new.source || ':' || new.source_id::text end;
  elsif TG_OP = 'UPDATE' then
    new.dedupe_key := old.dedupe_key;
  end if;

  if TG_OP = 'INSERT' then
    insert into collection_private.daily_item_usage as d(user_id, day, used) values(new.user_id, today, 1)
      on conflict(user_id, day) do update set used = d.used + 1 where d.used < 100
      returning used into count_used;
    if count_used is null then raise exception 'Günlük 100 yeni içerik sınırına ulaştın. Türkiye saatiyle 00:00 sonrasında yeniden ekleyebilirsin.'; end if;
    new.added_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create or replace function public.link_item_poster(target_item bigint, owner_id uuid, media_category text, tmdb_id bigint, image_path text)
returns public.items language plpgsql security definer set search_path='' as $$
declare saved public.items;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Yetkisiz işlem.'; end if;
  if media_category not in ('film','dizi') or tmdb_id is null or tmdb_id<=0 or image_path is null or image_path !~ '^/[a-zA-Z0-9_-]+\.(jpg|png|webp)$' then raise exception 'Geçersiz afiş.'; end if;
  update public.items set source='tmdb',source_id=tmdb_id,poster_path=image_path
  where id=target_item and user_id=owner_id and category=media_category
    and (source_id is null or (source='tmdb' and source_id=tmdb_id))
  returning * into saved;
  if not found then raise exception 'İçerik bulunamadı veya başka bir yapımla eşleştirilmiş.'; end if;
  return saved;
end;
$$;
revoke all on function public.link_item_poster(bigint,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.link_item_poster(bigint,uuid,text,bigint,text) to service_role;
notify pgrst,'reload schema';
commit;
