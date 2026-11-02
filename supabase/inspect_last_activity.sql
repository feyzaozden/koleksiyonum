-- SADECE OKUR. Tüm kullanıcıları, henüz aktiflik kaydı olmayanlar dahil listeler.
-- Tek kullanıcının işlem geçmişi için inspect_activity.sql dosyasını kullan.
select p.username as kullanici_adi,
  a.last_seen_at at time zone 'Europe/Istanbul' as yaklasik_son_aktiflik,
  case when a.user_id is null then 'Henüz aktiflik bildirimi yok' else 'Yaklaşık aktiflik bildirimi mevcut' end as durum
from public.profiles p
left join collection_private.activity_presence a on a.user_id=p.id
order by a.last_seen_at desc nulls last,p.username;
