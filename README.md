# Koleksiyonum

Kitap / film / dizi koleksiyonu takip uygulaması. React + Vite ile geliştirildi, veriler ve kimlik doğrulama Supabase üzerinde tutulur.

## Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env` olarak kopyalayıp kendi Supabase proje bilgilerinizi girin (proje kökünde zaten dolu bir `.env` bulunuyor, kendi projenize geçerken güncelleyin):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Supabase tarafında tabloları ve güvenlik kurallarını (RLS) oluşturmak için `supabase/schema.sql` dosyasını Supabase Dashboard > SQL Editor'de çalıştırın. Bu şema:

- `profiles` tablosu: her kullanıcının görünen adı ve avatarını tutar, `auth.users` ile birebir eşleşir, yeni kayıt olunca otomatik satır açan bir trigger içerir.
- `items` tablosu: koleksiyon öğeleri (kitap/film/dizi), `user_id` artık `auth.users.id` (uuid) referansı.
- RLS politikaları: herkes (giriş yapmış kullanıcılar) tüm koleksiyonları görebilir, ama sadece kendi öğelerini ekleyip/düzenleyip/silebilir.

Ayrıca Supabase Dashboard > Authentication > Providers'da Email/Password girişinin açık olduğundan emin olun.

## Geliştirme

```bash
npm run dev
```

## Derleme

```bash
npm run build
npm run preview
```

## Dosya yapısı

```
src/
  main.jsx              — uygulama girişi, Router + AuthProvider
  App.jsx                — route tanımları, korumalı rotalar
  index.css               — tüm görsel stiller (eski <style> bloğundan taşındı)
  lib/supabaseClient.js   — Supabase client (env değişkenlerinden)
  context/AuthContext.jsx — oturum, profil, signUp/signIn/signOut
  hooks/useItems.js       — items tablosu CRUD
  hooks/useProfiles.js    — tüm kullanıcı profillerini getirir
  hooks/useErrorToast.js  — hata mesajı gösterme yardımcı hook'u
  constants/tabs.js       — kitap/film/dizi sekme tanımları
  utils/format.js         — tarih biçimlendirme
  utils/filterSort.js     — arama/filtre/sıralama mantığı
  pages/LoginPage.jsx
  pages/SignupPage.jsx
  pages/AppPage.jsx       — ana koleksiyon ekranı (sekmeler, ekleme, liste)
  pages/ImdbPage.jsx       — tüm kullanıcıların ortalama puanlarına göre sıralı liste
  components/             — AddForm, ItemCard, ItemsGrid, EditModal, StarInput, vb.
```

## Kimlik doğrulama modeli

Eski sürümde sabit iki profil (Feyza / Ümmü Gülsüm) arasında şifresiz geçiş yapılıyordu. Bu sürümde herkes kendi e-posta/şifresiyle hesap açar (`/signup`), kayıt olurken görünen isim ve avatar emoji seçilir. Giriş yaptıktan sonra:

- Varsayılan olarak kendi koleksiyonun görünür.
- Üst kısımdaki "Koleksiyon" seçiciyle başka bir kullanıcının koleksiyonuna salt-okunur bakabilir ya da "Hepsi" seçeneğiyle herkesinkini üst üste görebilirsin.
- IMDb ekranı artık kayıtlı tüm kullanıcıların puanlarını ortalayarak sıralar.
