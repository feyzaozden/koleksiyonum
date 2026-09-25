# Kayıt doğrulaması

Yeni kayıt ve şifre yenileme: en az 8 karakter, en az bir A–Z, bir a–z ve bir
0–9 gerekir. Sembol, boşluk ve Türkçe karakter kullanılabilir; büyük/küçük harf
zorunluluğu Supabase ayarıyla eşleşmesi için A–Z / a–z üzerinden denetlenir.
Şifre kırpılmaz veya değiştirilmez. Giriş ekranında yeni şifre kuralları uygulanmaz.

E-posta doğrulaması yaygın internet adresleri içindir; tüm RFC adres türlerini
destekleme iddiası yoktur. Baş/son boşluklar temizlenir, iç boşluklar, hatalı @ ve
alan adı yapıları reddedilir. Artı adresleme desteklenir; sağlayıcı kısıtı yoktur.
Biçim kontrolü posta kutusunun varlığını veya sahibini doğrulamaz.

## Supabase tarafında gerekli ayarlar

Authentication içindeki Email sağlayıcısının şifre güvenliği ayarlarında:

- Minimum password length: **8**.
- Required characters: **Lowercase, uppercase letters and digits** (a–z, A–Z, 0–9).
- E-posta doğrulamasını açık tutun; kullanılabilir bir SMTP göndericisi gerekir.
- Profilde şifre değişikliği önce mevcut şifreyle hesabı doğrular, ardından yeni
  şifreyi `current_password` ile birlikte gönderir. API üzerinden de eski şifreyi
  zorunlu tutmak için Email ayarlarında **Require current password when changing
  password** seçeneğini açın. E-posta kurtarma bağlantısı akışını ayrıca test edin.

Bu ayarlar kodla otomatik uygulanmaz. Tarayıcı doğrulaması atlanabildiği için
sunucu ayarları gereklidir. SQL migration gerekmez; mevcut koleksiyonlar değişmez.
Sızdırılmış şifre koruması plan destekliyorsa ayrıca etkinleştirilebilir.

Kaynak: https://supabase.com/docs/guides/auth/password-security
