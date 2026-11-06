-- Run in Supabase SQL Editor. Re-running does not create a duplicate announcement.
begin;
insert into collection_private.announcements(id,title,body,icon)
values (
  '2026-11-06-item-posters',
  'Film ve dizilerine afiş ekle!',
  'Koleksiyonundaki film ve diziler artık afişleriyle daha güzel! Eski kayıtlarında görünen “Afiş seç” düğmesine dokun, doğru yapımı adı ve yılıyla kontrol ederek seç ve “Afişi kaydet” de. Notların, tarihlerin, ilerlemen, yorumların ve beğenilerin korunur. Aramadan yeni eklediğin film ve dizilerin afişleri, mevcutsa otomatik gelir.',
  '🎬'
)
on conflict (id) do nothing;
commit;
