## Şifre sıfırlama

Giriş ekranındaki **Şifremi unuttum** bağlantısı `/forgot-password` ekranını açar.
Kullanıcı e-posta adresini gönderir; e-postadaki bağlantı `/reset-password`
ekranında yeni şifre belirlemesini sağlar.

Supabase Dashboard > Authentication > URL Configuration > Redirect URLs listesine
`http://localhost:5173/reset-password` adresini ekleyin. Canlı ortam için ayrıca
`https://SITENIZIN-ADRESI/reset-password` adresini kendi alan adınızla ekleyin.
Yerel sunucu farklı bir portta çalışıyorsa izin verilen adresin portunu da değiştirin.
Özelleştirilmiş şifre sıfırlama e-posta şablonu kullanıyorsanız bağlantının
`{{ .ConfirmationURL }}` üzerinden doğrulama yaptığından emin olun.

Akışı doğrulamak için kayıtlı bir hesapla bağlantı isteyin, gelen e-postayı açın,
yeni şifreyi iki kez girin ve kaydedin. Ardından çıkış yapıp yeni şifreyle giriş
yapın. Geçersiz/süresi dolmuş bağlantıda yeni bağlantı isteme seçeneği görünmelidir.
