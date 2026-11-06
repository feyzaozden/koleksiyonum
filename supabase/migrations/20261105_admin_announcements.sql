-- Run once in SQL Editor after the existing project migrations.
-- Admin UUID was verified against the owner's feyza profile. No username-based authorization.
begin;
create schema if not exists collection_private;
revoke all on schema collection_private from public,anon,authenticated;
create table if not exists collection_private.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
insert into collection_private.app_admins(user_id)
select id from auth.users where id='0fccb04b-e2a1-4cbb-914a-6ba2abdce9f6'::uuid
on conflict do nothing;
create table if not exists collection_private.announcements (
  id text primary key default gen_random_uuid()::text,
  title text not null check(char_length(btrim(title)) between 1 and 200),
  body text not null check(char_length(btrim(body)) between 1 and 10000),
  icon text not null default '🔔' check(char_length(icon)<=16),
  published_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create table if not exists collection_private.announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id text not null references collection_private.announcements(id) on delete cascade,
  read_at timestamptz not null default clock_timestamp(),
  primary key(user_id,announcement_id)
);
alter table collection_private.app_admins enable row level security;
alter table collection_private.announcements enable row level security;
alter table collection_private.announcement_reads enable row level security;
revoke all on collection_private.app_admins,collection_private.announcements,collection_private.announcement_reads from public,anon,authenticated;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from collection_private.app_admins where user_id=auth.uid());
$$;

create or replace function public.get_announcements(page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  if page is null or page<0 or page>10000 then raise exception 'Geçersiz sayfa.'; end if;
  return jsonb_build_object(
    'unread',(select count(*) from collection_private.announcements a where a.deleted_at is null and not exists(
      select 1 from collection_private.announcement_reads r where r.announcement_id=a.id and r.user_id=auth.uid())),
    'has_more',(select count(*)>(page+1)*30 from collection_private.announcements where deleted_at is null),
    'entries',coalesce((select jsonb_agg(to_jsonb(row) order by row.published_at desc,row.id desc) from (
      select a.id,a.title,a.body as text,a.icon,a.published_at,a.updated_at,r.read_at
      from collection_private.announcements a left join collection_private.announcement_reads r on r.announcement_id=a.id and r.user_id=auth.uid()
      where a.deleted_at is null order by a.published_at desc,a.id desc offset page*30 limit 30
    ) row),'[]'::jsonb));
end;
$$;
create or replace function public.read_announcement(announcement_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  insert into collection_private.announcement_reads(user_id,announcement_id)
  select auth.uid(),a.id from collection_private.announcements a where a.id=announcement_id and a.deleted_at is null
  on conflict do nothing;
end;
$$;
create or replace function public.save_announcement(announcement_id text, heading text, content text, symbol text default '🔔', expected_updated_at timestamptz default null)
returns text language plpgsql security definer set search_path='' as $$
declare saved_id text;
begin
  perform 1 from collection_private.app_admins where user_id=auth.uid() for share;
  if not found then raise exception 'Bu işlem için yetkin yok.'; end if;
  if heading is null or content is null or char_length(btrim(heading)) not between 1 and 200 or char_length(btrim(content)) not between 1 and 10000 or char_length(coalesce(symbol,''))>16 then
    raise exception 'Başlık 1–200, metin 1–10.000 ve simge en fazla 16 karakter olmalı.';
  end if;
  if announcement_id is null then
    insert into collection_private.announcements(title,body,icon) values(btrim(heading),btrim(content),coalesce(nullif(btrim(symbol),''),'🔔')) returning id into saved_id;
  else
    update collection_private.announcements a set title=btrim(heading),body=btrim(content),icon=coalesce(nullif(btrim(symbol),''),'🔔'),updated_at=clock_timestamp()
    where a.id=announcement_id and a.deleted_at is null and a.updated_at=expected_updated_at returning a.id into saved_id;
    if not found then raise exception 'Duyuru değişmiş veya silinmiş. Listeyi yenileyip tekrar dene.'; end if;
  end if;
  return saved_id;
end;
$$;
create or replace function public.delete_announcement(announcement_id text, expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from collection_private.app_admins where user_id=auth.uid() for share;
  if not found then raise exception 'Bu işlem için yetkin yok.'; end if;
  update collection_private.announcements a set deleted_at=clock_timestamp(),updated_at=clock_timestamp()
  where a.id=announcement_id and a.deleted_at is null and a.updated_at=expected_updated_at;
  if not found then raise exception 'Duyuru değişmiş veya silinmiş. Listeyi yenileyip tekrar dene.'; end if;
end;
$$;
revoke all on function public.is_app_admin(),public.get_announcements(integer),public.read_announcement(text),public.save_announcement(text,text,text,text,timestamptz),public.delete_announcement(text,timestamptz) from public,anon,authenticated;
grant execute on function public.is_app_admin(),public.get_announcements(integer),public.read_announcement(text),public.save_announcement(text,text,text,text,timestamptz),public.delete_announcement(text,timestamptz) to authenticated;

-- Existing announcement seeds and read-state import are appended below.

insert into collection_private.announcements(id,title,body,icon,published_at) values
('2026-11-05-comments','Artık yorumlarla da paylaşabilirsin!','Arkadaşlarının kitaplarına, filmlerine ve dizilerine yorum yapabilir, yorumlara cevap verebilir ve beğeni ya da beğenmeme bırakabilirsin. İstersen yorumunu anonim paylaşabilirsin. Anonim yorumlarda adın, yorum tepkilerinde ise kimliğin diğer üyelere gösterilmez. İçerik kartındaki Yorumlar bölümünden sohbete katıl!','💬','2026-11-05T12:00:00+03:00'),
('2026-10-18-profile-privacy','Hesabının gizliliğini sen belirle','Profilim bölümünden hesabını açık veya gizli yapabilirsin. Açık hesabındaki içerikleri giriş yapan tüm üyeler görebilir; seni ekleyen kişiler onay beklemeden arkadaşın olur. Gizli hesapta ise arkadaşlık istekleri onayını bekler.','🔓','2026-10-18T12:00:00+03:00'),
('2026-10-18-media-search','Film ve dizileri arayarak ekle','Eklemek istediğin film veya dizinin adını ara, sonuçlardan seç ve koleksiyonuna ekle. Başlık, yönetmen veya yaratıcı bilgisi ve yıl otomatik dolsun.','🎬','2026-10-18T12:00:00+03:00'),
('2026-10-18-item-reactions','Arkadaşlarının içeriklerine tepki bırak','Arkadaşlarının kitaplarına, filmlerine ve dizilerine beğeni veya beğenmeme bırakabilirsin. İçerik sahibi tepki sayılarını görür; kimin tepki verdiği gösterilmez.','👍','2026-10-18T12:00:00+03:00'),
('2026-10-18-item-progress','Kaldığın yeri unutma','Kitabında kaçıncı sayfada, dizinde hangi sezon ve bölümde, filminde kaçıncı dakikada kaldığını kaydet. Toplam sayfa, sezon, bölüm veya süre bilgilerini girmek zorunda değilsin.','📖','2026-10-18T12:00:00+03:00'),
('2026-10-18-reaction-notifications','İçeriklerine gelen tepkilerden haberdar ol','Bildirimlerim bölümünden beğeni ve beğenmeme bildirimlerini görebilir, bildirime dokunarak ilgili içeriğe ulaşabilirsin. Tepki veren kişinin kimliği gizli kalır.',chr(128276),'2026-10-18T12:00:00+03:00')
on conflict(id) do nothing;
insert into collection_private.announcement_reads(user_id,announcement_id)
select u.id,a.id from auth.users u
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(u.raw_user_meta_data->'announcement_reads')='array' then u.raw_user_meta_data->'announcement_reads' else '[]'::jsonb end) old_read(id)
join collection_private.announcements a on a.id=old_read.id
on conflict do nothing;
notify pgrst,'reload schema';
commit;
