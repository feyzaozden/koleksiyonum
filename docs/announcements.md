# Duyuru yönetimi

Supabase SQL Editor’da `supabase/migrations/20261105_admin_announcements.sql` dosyasının tamamını çalıştır. Önceki migration dosyalarını yeniden çalıştırma. Bu işlem mevcut içerikleri silmez; eski altı duyuruyu ve hesapların okunma tercihlerini taşır.

Arayüz kodu yayımlandıktan sonra feyza hesabında Profilim → Admin → Duyuru paylaş bölümünü aç. Başlık ve metni yaz, Önizle’ye bas, ardından Yayımla’yı seç. Mevcut duyurular Düzenle veya onaylı Sil işlemleriyle yönetilir. Sonraki duyurular için kod değişikliği veya push gerekmez.

Bildirimlerim paneli her açılışta kişisel Bildirimler sekmesini gösterir. Duyurular ayrı Yenilikler sekmesindedir. Her sekmenin okunmamış sayısı ayrıdır; zil toplamını gösterir. Okundu kutusu kişisel bildirimi açmadan kaydeder. Duyuruların Okudum düğmesi yalnızca ilgili hesabın tercihini değiştirir.

Yetki, doğrulanmış hesap UUID’sine bağlı özel `app_admins` tablosunda tutulur; kullanıcı adı değişikliği veya kullanıcı metadata alanları yetki vermez. Yönetim RPC’leri yetkiyi veritabanında tekrar kontrol eder. Tablolar tarayıcıya açık değildir. Mevcut duyuru düzenlenince kimliği, yayın tarihi ve okunma durumu korunur. Aynı duyurunun eski sürümünden yapılan düzenleme/silme reddedilir; listeyi yenileyip tekrar denemek gerekir.

Eski `src/constants/announcements.js` yalnızca geçmiş kayıtların kaynağıdır; uygulama artık duyuruları veritabanından okur. Açık sayfalar yaklaşık 30 saniyede veya yeniden odaklanınca yeni duyuruları alır. Yeni üyeler de mevcut duyuruları görür. E-posta gönderilmez.
