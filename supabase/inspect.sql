-- Salt okunur inceleme: hiçbir kayıt değiştirilmez veya silinmez.
-- Supabase SQL Editor'da çalıştır. E-posta, not veya parola sorgulanmaz.
-- added_at uygulamadaki kayıt zamanıdır; tek başına otomasyon kanıtı değildir.

-- 1. Kullanıcı var mı, kaç kitap var, tarih aralığı nedir?
select
  p.username,
  count(i.id) as kitap_sayisi,
  min(i.added_at) at time zone 'Europe/Istanbul' as ilk_ekleme,
  max(i.added_at) at time zone 'Europe/Istanbul' as son_ekleme,
  count(distinct lower(btrim(i.title))) as farkli_baslik_sayisi
from public.profiles p
left join public.items i on i.user_id = p.id and i.category = 'kitap'
where lower(p.username) = 'alihan'
group by p.id, p.username;

-- 2. En çok kitap eklenen dakikalar.
select
  date_trunc('minute', i.added_at) at time zone 'Europe/Istanbul' as dakika,
  count(*) as eklenen_kitap,
  count(distinct lower(btrim(i.title))) as farkli_baslik,
  extract(epoch from max(i.added_at) - min(i.added_at)) as zaman_araligi_saniye
from public.items i
join public.profiles p on p.id = i.user_id
where lower(p.username) = 'alihan' and i.category = 'kitap'
group by date_trunc('minute', i.added_at)
order by count(*) desc, date_trunc('minute', i.added_at) desc
limit 20;

-- 3. Tekrar eden başlıklar (farklı baskılar da aynı başlığı taşıyabilir).
select lower(btrim(i.title)) as baslik, count(*) as tekrar_sayisi
from public.items i
join public.profiles p on p.id = i.user_id
where lower(p.username) = 'alihan' and i.category = 'kitap'
group by lower(btrim(i.title))
having count(*) > 1
order by count(*) desc
limit 30;

-- 4. Son 100 kitap ve önceki kayda göre süre farkı.
with entries as (
  select i.id, i.title, i.added_at,
    lag(i.added_at) over (order by i.added_at, i.id) as previous_at
  from public.items i
  join public.profiles p on p.id = i.user_id
  where lower(p.username) = 'alihan' and i.category = 'kitap'
)
select id, title,
  added_at at time zone 'Europe/Istanbul' as eklenme_zamani,
  extract(epoch from added_at - previous_at) as onceki_kayittan_sonra_saniye
from entries
order by added_at desc, id desc
limit 100;
