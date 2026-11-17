# Bağımsız kayıt ve oturum denemesi

Adres: http://localhost:3001/auth-lab

Bu ekran Supabase kullanmaz. Canlı kullanıcılar burada yoktur. Farklı bir deneme şifresiyle
test hesabı oluştur; gerçek hesabının şifresini kullanman gerekmez. E-posta gönderimi yoktur.

1. Ad soyad, kullanıcı adı, e-posta ve aynı şifreyi iki kez gir.
2. Kayıt olunca otomatik giriş yapılmaz. Yerel test posta kutusundaki doğrulama bağlantısını aç ve E-postamı doğrula'ya bas.
3. Giriş yap, sayfayı yenile; oturum devam etmeli.
4. Bağlantı iste bölümünde e-postanı yazıp Şifremi unuttum'a bas. Test posta kutusundaki sıfırlama bağlantısını aç ve yeni şifreyi iki kez gir.
5. Önceki oturum kapanmalı; eski şifreyle giriş reddedilmeli, yeni şifreyle giriş yapılabilmeli.
6. Önceki adımda oluşturduğun hesabın varsa yeni hesap açman gerekmez: Doğrulama bağlantısı iste. Mevcut açık oturumlar bu güncellemede topluca silinmez, yeni girişlerde doğrulama aranır.

Test posta kutusu yalnız bilgisayarındaki geliştirme ortamındadır. Gerçek e-posta göndermez,
adres sahipliğini gerçekten kanıtlamaz ve **sunucuda internete açılmamalıdır**.
En fazla son 30 mesaj bellekte tutulur; backend yeniden başlarsa tekrar bağlantı istemelisin.
Bağlantı açmak tek başına işlem yapmaz; ekrandaki onay düğmesi POST isteği gönderir.

## Teknik yapı

- POST /auth/register: kullanıcı ve profil tek atomik SQL fonksiyonunda oluşturulur.
- POST /auth/login: şifre doğrulanır, yeni rastgele oturum anahtarı üretilir.
- GET /auth/session: geçerli oturumun güvenli profil alanları döner.
- POST /auth/logout: oturum veritabanından kaldırılır, çerez silinir.
- POST /auth/request-verification ve /auth/forgot-password: uygun hesap için doğrulama/sıfırlama bağlantısı üretir. Hesap var/yok yanıt metni aynıdır.
- POST /auth/verify-email ve /auth/reset-password: tek kullanımlık bağlantıyı tüketir.
- GET /auth/local-inbox: yalnız loopback geliştirme ortamındaki test mesajları; özel başlık, Host ve kaynak kontrolleri vardır. Üretimde 404.
- 003_auth_links.sql: doğrulama için 24 saat, sıfırlama için 30 dakika geçerli 256 bit rastgele token. DB'de yalnız SHA-256 özeti tutulur; yeni istek aynı amaçlı eski bağlantıyı geçersiz kılar.
- SQL işlemi kullanıcı kilidi altında bağlantıyı tüketir. Sıfırlama şifreyi değiştirip o kullanıcının tüm oturumlarını ve kalan bağlantılarını aynı işlemde siler.
- Bağlantılar sabit AUTH_ORIGIN ile oluşturulur, token URL fragment'inde taşınır ve açılınca adres çubuğundan temizlenir. no-referrer kullanılır; token loglanmaz.
- Şifreler rastgele salt ile scrypt (N=131072,r=8,p=1) kullanılarak hash'lenir.
- 256 bit oturum anahtarı HttpOnly/SameSite=Lax çerezindedir; veritabanında yalnız SHA-256 özeti tutulur.
- HTTPS adresinde Secure ve __Host- çerez adı kullanılır. Yerelde HTTP için ayrı çerez adı vardır.
- Oturum 7 gün geçerli; girişte mevcut çerez değiştirilir. Hesap devre dışıysa erişim reddedilir.
- Kayıt/giriş IP ve e-posta bazlı veritabanı sayaçlarıyla sınırlandırılır.
- Değişiklik istekleri tam Origin kontrolünden geçer. CORS açılmaz.
- Backend tabloları doğrudan okuyamaz; yalnız dar kapsamlı accounts fonksiyonlarını çağırabilir.
- Küçük harfe çevrilen kullanıcı adları 3–30 karakter; şifre en az 8 karakter, büyük/küçük harf ve rakam.

## Henüz üretime hazır olmayan parçalar

Gerçek e-posta teslimatı, giriş yapılmışken mevcut şifreyle şifre değiştirme, gerçek kullanıcı aktarımı, frontend entegrasyonu,
reverse proxy arkasında güvenilir istemci IP'si ve üretim sertleştirmesi ayrı aşamalardır.
AUTH_LOCAL_REGISTRATION=true yalnız localhost/loopback origin ile kabul edilir.
Yerel hesabın email_verified_at alanı test bağlantısı onaylanınca doldurulur. Bu test hesapları canlıya taşınmaz.
Doğrulama varsayılan olarak zorunludur; eski test modu requireEmailVerification:false yalnız yerel kayıt moduyla oturuma izin verir ve Compose tarafından kullanılmaz.
Üretimde kayıt ve bağlantı işlemleri kapalıdır. Resend/SMTP gönderimi, teslimat hatası/yeniden deneme, hesap ön-kayıt kötüye kullanımı ve yanıt zamanlaması kontrolleri tamamlanmadan açılmamalıdır.
SQL fonksiyonları yalnız güvenilir backend rolü içindir; internetten doğrudan RPC olarak sunulmaz.

## Güncellemek

```powershell
docker compose -f compose.backend.yaml --env-file .env.backend.local --profile tools run --rm --build migrate
docker compose -f compose.backend.yaml --env-file .env.backend.local up -d --build backend
```

Test: `node --test tests/independentAuth.test.js tests/independentRecovery.test.js backend/tests/health.test.js`

Güvenlik tasarımı referansı: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
