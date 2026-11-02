-- SADECE OKUR. Kullanıcı adını aşağıda değiştirip dosyanın TAMAMINI çalıştır.
-- Ad Soyad değil, profilindeki kullanıcı adını yaz.
with input as (
  select lower(ltrim(btrim('KULLANICI_ADI'), '@')) as username
), target as (
  select p.id,p.username from public.profiles p,input x where lower(p.username)=x.username
)
select
  case when t.id is null then 'Kullanıcı bulunamadı. Profildeki kullanıcı adını kontrol et.'
       when a.id is null then 'Kullanıcı bulundu; henüz kayıtlı aktivitesi yok. Geçmiş işlemler geriye dönük oluşturulmaz.'
       else 'Aktivite kaydı' end as sonuc,
  coalesce(t.username,x.username) as aranan_kullanici,
  a.occurred_at at time zone 'Europe/Istanbul' as tarih,
  presence.last_seen_at at time zone 'Europe/Istanbul' as yaklasik_son_aktiflik,
  actor.username as islemi_yapan,
  subject.username as ilgili_kullanici,
  related.username as diger_kullanici,
  a.actor_id, a.subject_id, a.related_user_id,
  a.action as islem,
  case when a.action='auth_login' then 'Giriş yapıldı (yeni oturum)'
       when a.action='site_opened' then 'Site yeniden açıldı'
       when a.action='page_reloaded' then 'Sayfa yenilendi'
       when a.action='site_visit' then 'Site ziyareti'
       when a.action='site_active' then 'Yaklaşık aktiflik'
       else a.action end as aciklama,
  a.origin as kayit_kaynagi,
  a.record_id as kayit_kimligi,
  a.details as ayrintilar
from input x
left join target t on true
left join collection_private.activity_presence presence on presence.user_id=t.id
left join lateral (
  select h.* from collection_private.activity_history h
  where t.id in (h.actor_id,h.subject_id,h.related_user_id)
  order by h.occurred_at desc,h.id desc limit 500
) a on true
left join public.profiles actor on actor.id=a.actor_id
left join public.profiles subject on subject.id=a.subject_id
left join public.profiles related on related.id=a.related_user_id
order by a.occurred_at desc nulls last,a.id desc;
