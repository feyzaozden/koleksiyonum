# Test sunucusunda gerçek e-posta

Gönderici: noreply@koleksiyonum.com.tr. İzin verilen test alıcısı: koleksiyonum.destek@gmail.com.
Mevcut Supabase SMTP ayarları değişmez. Yeni backend Resend HTTPS API kullanır.

## Etkinleştirme

Önce backend'in güncel staging sürümü ve 004_verified_password.sql migration'ı yayınlanmış olmalı.
compose.staging.yaml, deploy/staging/Caddyfile ve configure-mail.sh sunucuya kopyalanmalı.
configure-mail.sh, Caddy dosyasını doğrular ve backend sağlıklı başladıktan sonra yeniden yükler.

Resend → API Keys: staging için ayrı bir Sending access anahtarı oluştur, alan adını koleksiyonum.com.tr ile sınırla.
Mevcut canlı SMTP anahtarını silme/değiştirme. Anahtar sohbete, Git'e veya GitHub Actions'a eklenmez.
Sunucuda:

```bash
cd ~/koleksiyonum-staging
sudo bash deploy/staging/configure-mail.sh
```

API key sorusunda anahtarı yapıştır (görünmez). Gönderici ve alıcı sorularında Enter varsayılanları kabul eder.
Betik `.env.staging.local` dosyasını root/600 izinleriyle günceller. Önceki ayarları `.env.mail-previous.local` içinde tutar.
Backend sağlıklı başlamazsa önceki ayarları geri yükler. Başarılı sağlık kontrolü e-posta teslimatının kanıtı değildir.
Bu betik e-posta göndermez. MAIL_MODE varsayılan disabled; anahtar eksik/biçimi yanlışsa resend modu başlamaz.

## Deneme

https://test.koleksiyonum.com.tr/auth-test adresinde izin verilen test e-postasıyla yeni hesap oluştur.
Gelen doğrulama bağlantısını aç, hesap şifresini belirle ve giriş yap.
Doğrulamada şifreyi yeniden belirlemek, başkasının e-postanla önceden seçmiş olabileceği şifreyi geçersiz kılar.
Şifremi unuttum bağlantısıyla sıfırlamayı dene; önceki oturumların kapandığını kontrol et.
Başarısız gönderimde hesap korunur: tekrar kayıt olmak yerine doğrulama bağlantısını yeniden iste.
Bu test hesabı canlı hesaptan ayrıdır; test verileri canlıya aktarılmaz.

## Sınırlar

- Resend'e yalnız sunucudan istek yapılır; tarayıcı anahtarı göremez.
- Gerçek gönderim yalnız MAIL_TEST_RECIPIENTS listesindeki adreslere yapılır. Herkese açık üretim kaydı henüz hedef değildir.
- Yerel /auth-lab ve /auth/local-inbox kapalı kalır. Test sayfası herhangi bir posta kutusu göstermez.
- İstek başına en fazla üç gönderim denemesi, 5 saniyelik timeout ve aynı idempotency key kullanılır.
- Kuyruk/worker henüz yoktur; süreç kapanırsa otomatik kalıcı yeniden deneme yapılmaz. Kullanıcı tekrar bağlantı ister.
- Resend'in kabulü teslim edildiği anlamına gelmez; gerçek teslimatı Resend Emails ekranı ve alıcı kutusundan doğrula.
- Provider hata gövdeleri, API anahtarı ve bağlantı tokenları loglanmaz. DB'de tokenların yalnız özeti tutulur.
- Backend hâlâ proxy başlıklarına güvenmez; IP limiti Caddy arkasındaki tüm test kullanıcıları için ortak olabilir. Public üretim öncesi güvenilir proxy/IP ve ek kötüye kullanım kontrolleri hazırlanmalı.
- Mevcut hesaplar/olmayan hesaplar için tekrar bağlantı isteği aynı genel mesajı döndürür; üretim öncesi yanıt zamanlaması ayrıca ele alınmalı.

Resend kaynakları: https://resend.com/docs/api-reference/emails/send-email ve https://resend.com/docs/dashboard/emails/idempotency-keys
