# Ziyaretçi profili ve öne çıkanlar

Supabase SQL Editor'de yalnızca `supabase/migrations/20261114_profile_featured.sql` dosyasının tamamını çalıştır. Mevcut içerikleri silmez; `featured_at` alanı ve sahiplik kontrolü yapan bir fonksiyon ekler. Önceki item guardrails ve profil gizliliği migration'ları kurulu olmalıdır.

Kendi koleksiyonunda kartın **⋯ → Öne çıkar** seçeneğini kullan. En fazla altı içerik seçebilirsin. **Öne çıkanlardan kaldır** seçeneği yalnızca profil vitrininden kaldırır; içerik silinmez.

Koleksiyon ekranındaki **Profilimi görüntüle** bağlantısı sade ziyaretçi görünümünü açar. Fotoğraf, ad, kullanıcı adı, biyografi, dört kategori sayısı ve seçilmiş öne çıkanlar görünür. Kategori seçilmeden tam koleksiyon sıralanmaz. Kategoriye tıklanınca arama, sıralama ve kartlar; karta tıklanınca not, tarih, ilerleme, tepkiler ve yorum bağlantısı açılır. Müzikte çalma listeleri korunur.

Gizlilik değişmez: kendi hesabın her zaman kendi koleksiyonunu görebilir; gizli profilin koleksiyonu ve öne çıkanları arkadaşlarına, açık profilinki giriş yapmış üyelere açıktır. Kendi profilini görüntülemek, arkadaş olmayan biri olarak yetki simülasyonu yapmaz.

Kontrol: Bir içerik öne çıkar, profilinde göründüğünü doğrula; kaldırmayı dene. Arkadaş hesabı ve arkadaş olmayan hesapla gizli/açık profil görünürlüğünü kontrol et. Telefonda kategori ve içerik penceresini, yorumlardan geri dönüşü dene. Otomatik veritabanı testleri sahipliği, altı içerik sınırını, gizliliği ve migration'ın tekrar çalıştırılmasını doğrular.
