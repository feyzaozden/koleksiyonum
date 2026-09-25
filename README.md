## Arkadaşlık ve koleksiyon paylaşımı

### Kullanıcı adı ve Ad Soyad geçişi

Yeni modelde `display_name` Ad Soyad bilgisidir; tekrar edebilir. Ayrı `username`
alanı benzersizdir. Kullanıcı adı 3–30 karakter, ilk karakter a–z; devamında a–z,
0–9, `_` ve `.` kabul eder. A–Z harfleri otomatik küçük harfe çevrilir. Boşluklar
silinerek düzeltilmez, reddedilir. Türkçe harfler Ad Soyad alanında kullanılabilir.

Yayınlamadan önce mevcut Supabase projesinin SQL Editor bölümünde
**`supabase/migrations/20260927_profile_usernames.sql`** dosyasını çalıştırın.
Önceki `20260926_unique_usernames.sql` dosyası bu model için kullanılmamalı;
çalıştırılmışsa yeni migration eski Ad Soyad benzersizlik kuralını kaldırır.
Arkadaşlık migration'ı uygulanmış olmalıdır.

Bu geçiş mevcut isimleri korur, kullanıcı adı olmayan profillere `kullanici_1`
gibi benzersiz adlar verir. Tekrar çalıştırılması atanmış adları değiştirmez.
Koleksiyonlar ve arkadaşlıklar ID ile bağlı olduğu için yeniden eşleştirme gerekmez.
Yeni kullanıcılar kayıt formunda Ad Soyad ve kullanıcı adını ayrı girer;
mevcut kullanıcılar Profilim bölümünden ikisini de değiştirebilir. Keşfet araması
kullanıcı adına göre çalışır; kartlarda Ad Soyad ve @kullanıcıadı birlikte gösterilir.
Dashboard üzerinden kullanıcı adı verilmeden oluşturulan hesaplar da otomatik
benzersiz bir kullanıcı adı alır. E-posta adresinden kullanıcı adı türetilmez.

Migration'dan sonra yeni frontend yayınlanmalıdır. Migration olmadan yeni
formlar ve kullanıcı adı araması çalışmaz.

- `/app`: yalnızca kendi koleksiyonun ve düzenleme işlemleri.
- `/discover`: isimle kullanıcı arama, arkadaşlar, gelen ve gönderilen istekler.
- `/people/:id`: temel profil; koleksiyon ve puanlar yalnızca arkadaşlara açık.
- `/profile`: isim, avatar ve herkese görünür kısa biyografi düzenleme.
- `/imdb`: kendin ve kabul edilmiş arkadaşlarının puanları/notları. Arkadaşlarının
  arkadaşları dahil edilmez. Ortak puan, mevcut hesaplamadaki gibi başlık ve kategoriye göre hesaplanır.

İsteği yalnızca alıcı kabul edebilir. Gönderen geri çekebilir, alıcı reddedebilir;
iki taraf da arkadaşlıktan çıkarabilir. Aynı çift için tek istek tutulur. Karşılıklı
istek otomatik onay sayılmaz. Kabulden sonra iki taraf da erişir; kaldırınca iki
tarafın erişimi kapanır. İsim, avatar ve biyografi giriş yapan kullanıcılara açıktır;
e-posta adresi arama sonuçlarında gösterilmez.

### Canlıya geçiş (gerekli)

1. Mevcut Supabase projesinde SQL Editor açıp
   `supabase/migrations/20260925_friendships.sql` dosyasının tamamını çalıştırın.
   Mevcut koleksiyonlar silinmez; eski kullanıcılar başlangıçta arkadaş değildir.
   Migration eski herkese açık koleksiyon erişimini arkadaşlarla sınırlar.
2. Sonra yeni frontend kodunu Vercel'e yayınlayın. Migration olmadan yeni ekranlar
   çalışmaz ve canlı veritabanının eski paylaşım kuralları değişmez.
3. İki test hesabıyla istek gönderin, kabul edin, iki yönde profil ve IMDb'yi
   kontrol edin. Üçüncü bir hesaba koleksiyonların kapalı olduğunu doğrulayın.
4. Arkadaşlığı kaldırın. Yenilenen profil ve IMDb'den verilerin kaybolduğunu kontrol edin.

Yeni Supabase kurulumunda önce `supabase/schema.sql`, sonra migration çalıştırılır.
Mevcut canlı kurulumda ana şemayı yeniden çalıştırmanız gerekmez.
Başka sekmede yapılan arkadaşlık işlemleri pencereye dönünce veya görünür
sekmedeki 30 saniyelik yenilemede yansır. Veritabanı erişimi her sorguda denetlenir.

### Yerel kontroller

```powershell
npm.cmd install
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

Testler geçici, yerel PGlite PostgreSQL veritabanında gerçek şemayı ve migration'ı
çalıştırır. Üretim veritabanına bağlanmaz; istek yetkilerini, karşılıklı görünürlüğü,
reddetme/iptali, erişimin kaldırılmasını ve IMDb verilerinin kapsamını kontrol eder.
RLS yaklaşımı: https://supabase.com/docs/guides/database/postgres/row-level-security

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
