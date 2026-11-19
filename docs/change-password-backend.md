# Profilim: şifre değiştirme

Deneme ekranında Profilim → Şifre değiştir (+) açılır. Mevcut şifre ve iki kez
yeni şifre istenir. Yeni şifre 8–128 karakter, büyük/küçük harf ve rakam içerir.
Kurallar ikinci yeni şifre alanının altındadır. Şifremi unuttum düğmesi mevcut
hesabın e-postasına daha önce kurduğumuz sıfırlama akışını kullanarak bağlantı ister.

## Dosyalar ve akış

- `src/independent/PasswordForm.jsx`: Form ve bildirimler. Şifreleri kalıcı tarayıcı
  depolamasına yazmaz; başarıda veya bölüm kapanınca alanları temizler.
- `backend/src/app.js`: `/api/collection/password` isteğini auth işleyicisine bağlar.
  Mevcut Caddy `/api/collection/*` yönlendirmesi kullanılır.
- `backend/src/auth.js`: Oturum, Origin, mevcut şifre, yeni şifre kuralları ve
  tekrar alanını kontrol eder. Hesap başına 15 dakikada 10 deneme sınırı vardır;
  mevcut genel auth IP limiti de uygulanır.
- `backend/migrations/009_change_password.sql`: Hesabı kilitler, kontrol edilen
  eski şifre özetinin hâlâ güncel olduğunu ve oturumun geçerli kaldığını doğrular.
  Şifre güncelleme ve oturum yenileme tek transaction içinde gerçekleşir.

Yeni şifre scrypt ile rastgele salt kullanılarak özetlenir. Düz metin olarak
veritabanına veya loglara yazılmaz. Diğer tüm oturumlar ve eski doğrulama/sıfırlama
bağlantıları iptal edilir. Mevcut tarayıcıya yeni HttpOnly/Secure oturum çerezi
verilir. İstek sırasında başka bir şifre sıfırlama gerçekleşirse eski kontrol
yeni şifreyi ezemez.

Yeni SQL yalnızca kendi deneme PostgreSQL'imize otomatik uygulanır. Supabase
kullanıcıları ve şifreleri değişmez. Gerçek kullanıcı şifresiyle otomatik test
yapılmaz; testler ayrı PGlite veritabanı ve sentetik hesap kullanır.
