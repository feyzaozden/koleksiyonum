-- Run after the existing items/friendships/progress migrations.
-- Preserves existing records, including duplicates and older invalid fields.
begin;
create schema if not exists collection_private;
revoke all on schema collection_private from public, anon, authenticated;

alter table public.items add column if not exists source text;
alter table public.items add column if not exists source_id bigint;
alter table public.items add column if not exists dedupe_key text;

create table if not exists collection_private.daily_item_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null check (used between 0 and 100),
  primary key(user_id, day)
);
create table if not exists collection_private.item_creation_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default 'Yeni içerik ekleme geçici olarak kısıtlandı.',
  blocked_at timestamptz not null default clock_timestamp()
);
revoke all on all tables in schema collection_private from public, anon, authenticated;
alter table collection_private.daily_item_usage enable row level security;
alter table collection_private.item_creation_blocks enable row level security;

create or replace function public.normalize_item_identity(value text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(translate(lower(translate(normalize(coalesce(value,''), NFKC), 'İ', 'i')), 'ı', 'i'), '[[:space:]]+', ' ', 'g'))
$$;
create or replace function public.item_identity_key(title text, creator text, year text)
returns text language sql immutable set search_path = '' as $$
  select md5(jsonb_build_array(public.normalize_item_identity(title), public.normalize_item_identity(creator), btrim(coalesce(year,'')))::text)
$$;

-- Old rows keep NULL keys. Indexes enforce uniqueness for all new/changed identities.
create unique index if not exists items_new_identity_unique on public.items(user_id, category, dedupe_key) where dedupe_key is not null;
create unique index if not exists items_source_unique on public.items(user_id, category, source, source_id) where source_id is not null;
create index if not exists items_legacy_identity_lookup on public.items(user_id, category, public.item_identity_key(title, creator, year));

-- Seed today's usage once. Reruns never reset a user's counter.
insert into collection_private.daily_item_usage(user_id, day, used)
select user_id, (clock_timestamp() at time zone 'Europe/Istanbul')::date, least(count(*),100)::integer
from public.items
where (added_at at time zone 'Europe/Istanbul')::date = (clock_timestamp() at time zone 'Europe/Istanbul')::date
group by user_id on conflict do nothing;

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
    if new.source is distinct from old.source or new.source_id is distinct from old.source_id then
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
    or new.year is distinct from old.year or new.category is distinct from old.category;
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
revoke all on function collection_private.guard_item_write() from public, anon, authenticated;
drop trigger if exists items_guard_write on public.items;
create trigger items_guard_write before insert or update on public.items for each row execute function collection_private.guard_item_write();

-- Direct API writes may only supply manual fields. Source IDs are server verified.
revoke insert, update on public.items from public, anon, authenticated;
revoke insert(source,source_id,dedupe_key), update(source,source_id,dedupe_key) on public.items from public, anon, authenticated;
grant insert(user_id, category, title, creator, year, status, note, start_date, end_date, rating, emoji, progress) on public.items to authenticated;
grant update(category, title, creator, year, status, note, start_date, end_date, rating, emoji, progress) on public.items to authenticated;
-- Supabase's service role is used ONLY by the verified creation endpoint.
grant select, insert on public.items to service_role;
grant usage, select on sequence public.items_id_seq to service_role;

create or replace function public.get_item_creation_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare today date := (clock_timestamp() at time zone 'Europe/Istanbul')::date;
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  return jsonb_build_object('used', coalesce((select used from collection_private.daily_item_usage where user_id=auth.uid() and day=today),0),
    'limit',100,'blocked',exists(select 1 from collection_private.item_creation_blocks where user_id=auth.uid()),
    'resets_at', ((today + 1)::timestamp at time zone 'Europe/Istanbul'));
end;
$$;
revoke all on function public.get_item_creation_status() from public, anon, authenticated;
grant execute on function public.get_item_creation_status() to authenticated;

-- Manual bulk import with per-row outcomes. Each successful row consumes one slot.
create or replace function public.import_collection_items(entries jsonb)
returns table(row_number integer, outcome text, item_id bigint, message text)
language plpgsql security invoker set search_path = '' as $$
declare entry jsonb; n integer := 0; created_id bigint;
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  if jsonb_typeof(entries) is distinct from 'array' then raise exception 'Bir içerik listesi gönder.'; end if;
  if jsonb_array_length(entries) > 100 then raise exception 'Tek istekte en fazla 100 içerik gönder.'; end if;
  for entry in select value from jsonb_array_elements(entries) loop
    n := n+1;
    begin
      if jsonb_typeof(entry) is distinct from 'object' or entry ?| array['source','source_id','user_id','added_at','dedupe_key'] then
        raise exception 'Toplu eklemede yalnızca elle girilen içerik alanları kullanılabilir.';
      end if;
      insert into public.items(user_id,category,title,creator,year,status,note,start_date,end_date,rating,emoji,progress)
      values(auth.uid(),entry->>'category',entry->>'title',entry->>'creator',entry->>'year',coalesce(entry->>'status','bekliyor'),
        entry->>'note',nullif(entry->>'start_date','')::date,nullif(entry->>'end_date','')::date,(entry->>'rating')::smallint,
        entry->>'emoji',coalesce(entry->'progress','{}'::jsonb)) returning id into created_id;
      return query select n,'added'::text,created_id,null::text;
    exception
      when unique_violation then return query select n,'duplicate'::text,null::bigint,'Bu içerik zaten koleksiyonunda.'::text;
      when raise_exception then return query select n,'rejected'::text,null::bigint,SQLERRM;
      when others then return query select n,'rejected'::text,null::bigint,'Alanları, kategori ve tarih biçimlerini kontrol et.'::text;
    end;
  end loop;
end;
$$;
revoke all on function public.import_collection_items(jsonb) from public, anon, authenticated;
grant execute on function public.import_collection_items(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
