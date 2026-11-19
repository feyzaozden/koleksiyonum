# İlerleme ve TMDB taşıması

Bu aşama yalnızca bağımsız deneme veritabanını ve `/collection-app` ekranını
değiştirir. Supabase SQL Editor'de işlem yapılmaz. Yeni `006_progress_catalog.sql`
dosyası CI dağıtımında otomatik uygulanır; önceki SQL dosyaları değiştirilmez.

## İşleyiş

1. Film/dizi araması `/api/collection/catalog?category=film&q=...` adresine gider.
2. `backend/src/items.js` HttpOnly oturum çerezini doğrular; doğrulanmış hesabı
   olmayan istek TMDB'ye ulaşmaz. Hesap başına dakikada 60 katalog isteği sınırı
   süreç belleğindedir; yeniden başlatmada sıfırlanır, çoklu sunucuda ortak değildir.
3. `backend/src/catalog.js` TMDB'ye sunucudaki anahtarla bağlanır. Beş dakikalık
   sınırlı önbellek kullanır; yetişkin ve gelecekte yayımlanacak sonuçları eler.
4. Kullanıcı seçim yapınca ayrıntılar forma dolar. Kaydetmede istemci yalnızca
   kategori, TMDB numarası ve kişisel alanları gönderir. Backend katalog verisini
   yeniden alır (önbellek kullanılabilir); başlık/yıl/yapımcı/afiş istemciden alınmaz.
5. `create_catalog_item` aynı günlük kota ve tekrar kontrolünü kullanır. Hatalı
   eklemede kota da geri alınır. Katalog kaydında kişisel not, puan, durum ve
   tarihler düzenlenebilir; TMDB başlığı değiştirilemez.

## İlerleme

`ItemProgress` ve `ProgressDialog` mevcut arayüzden tekrar kullanılır. Kitap için
sayfa, film için dakika, dizi için sezon/bölüm girilir. Toplamlar isteğe bağlıdır.
İlerleme PATCH isteğiyle ve `revision` sürüm kontrolüyle kaydedilir.
Veritabanı trigger'ı alanları, tam sayıları, toplamları ve sezon/bölüm ilişkisini
doğrular. “Bitirdim” bitiş tarihiyle tamamlar; dizi bitirirken sezon/bölüm istenmez.
Tamamlanan içerikte ilerleme çubuğu, tamamlanan filmde dakika gösterilmez.

## Sunucu ayarı

`compose.staging.yaml` backend'e `TMDB_READ_ACCESS_TOKEN` ortam değişkenini verir.
Anahtar imaja veya Git'e eklenmez. Sunucuda güncel compose dosyası bulunduktan
sonra `sudo bash deploy/staging/configure-catalog.sh` anahtarı görünmeden alır,
korumalı ortam dosyasını günceller ve backend'i başlatır. Başarısız başlatmada
önceki ortam ayarlarını geri yükler. Canlı sistemin anahtarı değiştirilmez.

Testler: `tests/independentCatalogProgress.test.js`,
`tests/independentItems.test.js`. Gerçek kullanıcı kayıtlarını değiştirmeden
ayrı PGlite veritabanında çalışırlar; TMDB yanıtı testte taklit edilir.
