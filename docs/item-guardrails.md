# İçerik ekleme korumaları

## Kurulum sırası

1. Supabase SQL Editor'da `supabase/migrations/20261014_item_guardrails.sql` dosyasını çalıştır. Ana schema.sql dosyasını tekrar çalıştırma. Önceden kullanılan arkadaşlık ve ilerleme migration'ları uygulanmış olmalı.
2. Supabase projesi > Settings > API Keys bölümünden sunucu için bir **Secret key** (`sb_secret_...`) oluştur/al. Bunu `.env.local` dosyasına **SUPABASE_SECRET_KEY** adıyla ekle. Başına VITE_ ekleme, sohbete veya Git'e koyma. Mevcut public/anon ve TMDB anahtarlarını değiştirme.
3. Yerel Vite sunucusunu yeniden başlat. Film/dizi seçerek ve elle kitap girerek dene.
4. Canlı için aynı `SUPABASE_SECRET_KEY` değişkenini Vercel Production ortamına ekle. Ardından bu kod yayımlanmalı/redeploy yapılmalı. Eski service_role JWT anahtarı varsa sunucuda `SUPABASE_SERVICE_ROLE_KEY` değişkeni de desteklenir; yeni Secret key tercih edilir.

Secret key veritabanında yüksek yetkilidir. Yalnızca server/createItem.js tarafından okunur; kullanıcı oturumu Supabase Auth ile doğrulanır, sahip kimliği istemciden kabul edilmez. Kaynak başlık/yıl/yaratıcı TMDB'den alınır. İstemci source ve source_id sütunlarına doğrudan yazamaz. İşlem mevcut hesabı veya TMDB ayarını değiştirmez.

Resmi anahtar belgesi: https://supabase.com/docs/guides/getting-started/api-keys

## Kurallar

- Günlük 100 başarılı yeni kayıt; kitap/film/dizi toplamı. Gün sınırı veritabanında Europe/Istanbul saat dilimiyle belirlenir.
- Dakikalık ekleme sınırı yoktur. Bir seferde 100 satır gönderilebilir; kalan günlük hak kadar geçerli kayıt eklenir.
- Silme, düzenleme ve başarısız girişimler hak iadesi/harcaması yapmaz. Sınır sayacı istemcinin değiştiremediği özel şemadadır. Yeni added_at değerini veritabanı üretir.
- İlk kurulum, bugün mevcut kayıt sayısıyla sayacı başlatır (en fazla 100). Önceden silinmiş kayıtları/tarih sahteciliğini geriye dönük yeniden kuramaz. Bundan sonraki eklemelerde sayaç güvenilirdir.
- Sayacı artıran koşullu upsert günlük kota satırını kilitler; paralel eklemeler 100'ü aşamaz. Kimlik karşılaştırmaları hesap başına transaction kilidi, yeni kayıtların kesin kimlikleri ayrıca unique index ile korunur.
- Seçilen film/dizi için kullanıcı + kategori + TMDB kimliği benzersizdir. Aynı TMDB numarasına sahip film ve dizi birbirinden farklıdır. Kaynak kimliği sonradan değiştirilemez.
- Elle eklemede başlık + yazar/yönetmen + yıl + kategori karşılaştırılır. Unicode uyumluluk biçimi, harf büyüklüğü, Türkçe I/İ/ı ve boşluk farkları normalize edilir. Noktalama, farklı yıl/yazar ve çeviri başlıkları otomatik aynı eser kabul edilmez.
- Başlığı aynı olan mevcut kayıtlar için formda olası tekrar uyarısı görünür. Tam eşleşmeler veritabanından reddedilir. İki farklı doğrulanmış TMDB kaydı aynı görünen bilgilere sahip olabilir; kaynak kimlikleri ayrıysa izin verilir.
- Başlık ve yaratıcı 300, not 3000, simge 16 karakter sınırındadır. Boş başlık/kontrol karakteri, gelecek yıl, gelecek tarih ve başlangıçtan önce bitiş reddedilir. Kategori, puan ve ilerleme mevcut veritabanı kurallarıyla doğrulanır.
- Eski tekrarlar veya eski geçersiz alanlar silinmez/düzeltilmez. Değişmeyen eski alanlar yüzünden puan/ilerleme güncellemesi engellenmez. Kimlik bilgilerini değiştiren düzenleme yeni tekrar oluşturamaz.

## Toplu ekleme

Kullan?c? aray?z?nde toplu ekleme b?l?m? bulunmaz. G?nl?k kullan?m sayac? ve hak yenilenme bilgisi de formda g?sterilmez; g?nl?k s?n?r veritaban?nda uygulanmaya devam eder.

`import_collection_items` RPC'si en fazla 100 satır kabul eder; her satır kendi hata bloğunda işlenir. Diğer hesaba yazma ve kaynak/sayaç/tarih alanını sahteleme engellenir. Ham çok satırlı SQL/REST insert normal PostgreSQL davranışıyla tümü birlikte başarılı/başarısız olabilir; kısmi başarı için bu RPC kullanılır.

## Yönetici kısıtlaması

Bu çalışmada hiçbir hesap kısıtlanmadı. Gerekirse yalnızca SQL Editor'da, doğru kullanıcı kimliğini doğruladıktan sonra kullan:

```sql
-- Önce hesabı doğrula (kullanıcı adını değiştir):
select id, username from public.profiles where username = 'HEDEF_KULLANICI_ADI';

-- Yalnızca yeni içerik eklemeyi durdurur; mevcut verileri silmez:
insert into collection_private.item_creation_blocks(user_id, reason)
select id, 'İçerik ekleme incelemesi' from public.profiles
where username = 'HEDEF_KULLANICI_ADI'
on conflict (user_id) do update set reason = excluded.reason;

-- Kısıtlamayı kaldırmak için ayrı çalıştır:
delete from collection_private.item_creation_blocks
where user_id in (select id from public.profiles where username = 'HEDEF_KULLANICI_ADI');
```

Kısıtlanmış hesap giriş yapabilir, mevcut içeriğini düzenleyebilir/silebilir ve ilerlemesini güncelleyebilir. Bu bir tüm-hesap engellemesi değildir. Diğer kullanıcılar kısıtlama gerekçelerini veya kota kayıtlarını okuyamaz.

## Eski tekrarları salt okunur raporlama

```sql
select p.username, i.category,
  public.normalize_item_identity(i.title) as normalized_title,
  public.normalize_item_identity(i.creator) as normalized_creator,
  i.year, count(*) as copies, array_agg(i.id order by i.id) as item_ids
from public.items i join public.profiles p on p.id = i.user_id
group by p.username, i.category, public.normalize_item_identity(i.title), public.normalize_item_identity(i.creator), i.year
having count(*) > 1 order by count(*) desc;
```

Hiçbir otomatik birleştirme yapılmaz; farklı not, tarih, ilerleme ve oylar korunur.

## Sınırlar ve sonraki adım

Bu kontroller AI metni sınıflandırıcısı değildir. Farklı başlık/yazar/yıl uyduran bir kullanıcı günde 100 sınırı içinde spam ekleyebilir. Elle giriş, çeviri başlıklar ve kitap baskılarında kusursuz eser eşleştirmesi sağlamaz. Kaynak seçilmeden eski istemcilerden gelen kayıtlar da elle ekleme sayılır.

Kitap API anahtarı henüz kurulmadığından kitaplarda Google Books/ISBN/eser-baskı eşleştirmesi bu değişikliğe dahil değildir. Bir sonraki entegrasyonda eser kimliği ile baskı kimliği ayrı tutulmalı; baskı sayfa sayısı, okunan sayfayla karıştırılmamalıdır.

Kota gün başına toplam kayıt hacmini sınırlar; ayrı hesap açılmasını veya başarısız isteklerle servise yük bindirilmesini tamamen engellemez. Gerekirse kayıt doğrulaması, istek oranı sınırlaması ve yönetici incelemesi ayrıca ele alınır.

Testler PGlite üzerinde migration'ın tekrar uygulanmasını, mevcut kayıtların korunmasını, grant/RLS kurallarını, kota, silme sonrası kota, toplu sonuçlar ve kısıtlamayı doğrular. API testleri kullanıcı/kaynak sahteciliği ile hata akışını doğrular. Canlı DB migration'ı/anahtar kurulumu yapılmadan uçtan uca üretim testi yapılamaz.
