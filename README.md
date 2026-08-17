# Koleksiyonum

Kitap / film / dizi koleksiyonu takip uygulaması. React + Vite ile geliştirildi, veriler ve kimlik doğrulama Supabase üzerinde tutulur.



## Kimlik doğrulama modeli

Eski sürümde sabit iki profil arasında şifresiz geçiş yapılıyordu. Bu sürümde herkes kendi e-posta/şifresiyle hesap açar (`/signup`), kayıt olurken görünen isim ve avatar emoji seçilir. Giriş yaptıktan sonra:

- Varsayılan olarak kendi koleksiyonun görünür.
- Üst kısımdaki "Koleksiyon" seçiciyle başka bir kullanıcının koleksiyonuna salt-okunur bakabilir ya da "Hepsi" seçeneğiyle herkesinkini üst üste görebilirsin.
- IMDb ekranı artık kayıtlı tüm kullanıcıların puanlarını ortalayarak sıralar.
