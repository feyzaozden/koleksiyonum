# Koleksiyon arayüzünün ilk bağlantısı

Bu aşama yalnızca deneme ortamında kendi kayıtlarını listeleme içindir.
Canlı React uygulaması ve Supabase bağlantıları değişmedi. Yeni ekran
`https://test.koleksiyonum.com.tr/collection-app` adresindedir. Önce `/auth-test`
üzerinden deneme hesabıyla giriş yapılır. Oturum çerezi HttpOnly olarak tarayıcı
tarafından gönderilir; JavaScript şifre veya oturum anahtarı saklamaz.

## Dosyalar ve akış

- `src/independent/main.jsx`: React ekranı. Mevcut CSS, FilterBar, StatsBar,
  yıldızlar ve not bileşenlerini kullanır. Dört kategori, arama, sıralama,
  yüklenme, boş liste ve hata durumlarını gösterir.
- `src/independent/client.js`: Önce `/auth/session` ile oturum kontrol edilir;
  `/api/collection` sayfaları 50'şer kayıtla alınır. Tüm kayıtlar yüklenmeden
  filtreleme yapılmaz. Böylece 51. kayıt aramada kaybolmaz.
- `collection-app.html`: Ayrı React giriş noktası. Supabase sağlayıcılarını
  yüklemez. Kullanıcı kimliği API'ye parametre olarak gönderilmez.
- `vite.independent.config.js`: Ekranı `backend/pages/collection-ui` içine
  derler. Bu üretilen klasör Git'e girmez; CI her dağıtımda yeniden oluşturur.
- `backend/src/app.js`: HTML ve yalnızca izin verilen JS/CSS dosyalarını sunar.
- `deploy/staging/Caddyfile`: `/collection-app` isteklerini backend'e yönlendirir.

Örnek: Film sekmesine basınca yüklenen kendi kayıtların arasından filmler
seçilir. Arama ve sıralama mevcut uygulamanın `filterAndSortItems` fonksiyonunu
kullanır. Oturum yoksa giriş bağlantısı, servis hatasında tekrar deneme görünür.

Yerelde paket üretme: `npx.cmd vite build --config vite.independent.config.js`.
Backend Docker imajını yerelde oluştururken de önce bu komut çalıştırılmalıdır.
CI bunu otomatik yapar. Sunucuda Caddyfile güncellendikten sonra validate ve
reload gerekir. Supabase SQL Editor'de çalıştırılacak yeni SQL yoktur.

Sonraki aşama: mevcut ekleme/düzenleme pencerelerini bağımsız API'ye bağlamak.
Sosyal özellikler, katalog araması, müzik oynatma ve ilerleme bu ekranda henüz
etkin değildir. Manuel test ekranı `/collection-test` kullanılabilir durumda kalır.
