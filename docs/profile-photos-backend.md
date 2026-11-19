# Profil fotoğrafları

Bu aşama deneme sunucusundadır; Supabase'teki mevcut fotoğraflar taşınmaz veya silinmez.

Profilim penceresinde dosya seçmek fotoğrafı hemen yükler. Yazı alanları ayrıca
Kaydet ile kaydedilir. Fotoğraf değiştirmek, henüz kaydedilmeyen biyografi veya
kullanıcı adı taslağını silmez. Kaldırma yalnızca profil fotoğrafını kaldırır.

## Dosya nasıl saklanıyor?

1. Tarayıcı resmi `/api/collection/profile/photo` adresine PUT ile gönderir.
2. `backend/src/profile-photo.js` oturumu ve istek kaynağını doğrular. Dosya üst
   sınırı 5 MB, çözümlenen resim sınırı 16 megapikseldir.
3. Sharp, gerçek resim türünü kontrol eder. Yalnızca tek kareli JPEG, PNG ve WebP
   kabul edilir; SVG ve hareketli resimler kabul edilmez. Resim yönü düzeltilir,
   ortadan kırpılarak 512×512 WebP üretilir. EXIF/konum bilgileri saklanmaz.
4. `008_profile_photos.sql` içindeki fonksiyon, yalnızca oturum sahibinin
   fotoğrafını kaydeder. Sürüm kontrolü başka sekmedeki değişikliğin ezilmesini
   önler. Yeni fotoğraf eskisinin yerine geçer; tekrar tekrar dosya birikmez.
5. GET resmi, DELETE kaldırma işlemini sağlar. Şimdilik yalnızca sahibi görebilir;
   arkadaş/profil görünürlüğü taşınırken diğer kullanıcıların erişimi eklenecek.

## Neden veritabanı?

Küçük profil fotoğrafları kendi sunucumuzdaki PostgreSQL'de `bytea` olarak
saklanır; normalize edilen dosya en fazla 512 KB'dır. Ayrı yükleme klasörü veya
Storage servisi gerekmez ve Docker imajı değişince kaybolmaz. Bağımsız PostgreSQL
veri yedeği alındığında fotoğraflar da kapsanır. Eski Supabase yedekleri bu yeni
veritabanını kapsamaz. Çok sayıda büyük medya dosyası için daha sonra ayrı dosya
depolaması değerlendirilir.

Migration otomatik uygulanır; Supabase SQL Editor'de işlem yapma.
