-- Read-only. Change the username on this line, then Run in SQL Editor.
with target as (
  select id from public.profiles where username='KULLANICI_ADI'
)
select
  a.occurred_at at time zone 'Europe/Istanbul' as tarih,
  actor.username as islemi_yapan,
  subject.username as ilgili_kullanici,
  related.username as diger_kullanici,
  a.actor_id, a.subject_id, a.related_user_id,
  a.action as islem,
  case when a.action='auth_login' then 'Giriş yapıldı (yeni oturum)'
       when a.action='site_visit' then 'Site ziyareti'
       when a.action='site_active' then 'Yaklaşık aktiflik'
       else a.action end as aciklama,
  a.origin as kayit_kaynagi,
  a.record_id as kayit_kimligi,
  a.details as ayrintilar
from collection_private.activity_history a
left join public.profiles actor on actor.id=a.actor_id
left join public.profiles subject on subject.id=a.subject_id
left join public.profiles related on related.id=a.related_user_id
where exists(select 1 from target t where t.id in (a.actor_id,a.subject_id,a.related_user_id))
order by a.occurred_at desc,a.id desc
limit 500;

-- Approximate last activity for all accounts. This is NOT an online indicator.
select p.username, a.last_seen_at at time zone 'Europe/Istanbul' as yaklasik_son_aktiflik
from collection_private.activity_presence a
join public.profiles p on p.id=a.user_id
order by a.last_seen_at desc;
