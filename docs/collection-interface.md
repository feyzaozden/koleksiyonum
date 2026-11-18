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

## Ekleme, düzenleme ve silme bağlantısı

`ItemFormDialog.jsx` ekleme ve düzenleme için aynı pencereyi kullanır. Mevcut
DateField ve StarInput bileşenleri korunur. Backend henüz katalog ve ilerleme
alanlarını kabul etmediği için form sadece manuel içerik alanlarını gönderir.
`ItemMenu.jsx` kartın üç nokta menüsünü oluşturur; dışarı tıklanınca veya Escape
ile kapanır. Silme için mevcut `DeleteConfirm` bileşeni kullanılır.

`client.js` içindeki `saveItem` yeni kayıt için POST, mevcut kayıt için PATCH,
`removeItem` DELETE gönderir. Kullanıcı kimliği gönderilmez, oturum çerezi
backend tarafından doğrulanır. PATCH ve DELETE mevcut kaydın `revision`
değerini taşır. Başka bir sekmede değişen kayıt böylece yanlışlıkla ezilmez.
Başarısız kaydetmede form açık kalır. Başarılı işlemde React listesi sunucudan
dönen kayıtla güncellenir; sayfayı yenilemek gerekmez. Listeyi yenile düğmesi
diğer sekmelerdeki değişiklikleri tekrar yükler.

Sonraki aşama: ilerleme bilgileri ve katalog araması.
Sosyal özellikler, katalog araması, müzik oynatma ve ilerleme bu ekranda henüz
etkin değildir. Manuel test ekranı `/collection-test` kullanılabilir durumda kalır.
