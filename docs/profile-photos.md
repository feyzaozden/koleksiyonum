# Profil fotoğraflarını etkinleştirme

1. Supabase projenizde **SQL Editor → New query** açın.
2. `supabase/migrations/20260928_profile_photos.sql` dosyasının tamamını yapıştırıp **Run** düğmesine basın. Önceki migration dosyalarını veya ana şemayı yeniden çalıştırmayın.
3. **Storage** bölümünde `profile-photos` alanı oluşur. Private olarak bırakın; ayrıca bucket veya policy oluşturmanız gerekmez.
4. Uygulamayı açın: **Profilim → Fotoğraf seç → Fotoğrafı yükle**. JPG, PNG ve WebP desteklenir; en fazla 5 MB kabul edilir. Fotoğrafı kaldırmak onay gerektirir ve emoji avatara döner.
5. İkinci bir hesapla Keşfet ve profil ekranında fotoğrafın göründüğünü kontrol edin. Telefon ve bilgisayarda deneyin.

Bu migration mevcut profil, koleksiyon ve arkadaşlık kayıtlarını silmez. Fotoğraflar Storage içinde, dosya yolları profilde tutulur. Oturum açmış kullanıcılar fotoğrafları görüntüleyebilir; kullanıcı yalnızca kendi klasörüne yükleyebilir veya kendi fotoğrafını silebilir. Koleksiyonların arkadaşlık izinleri değişmez.

Yeni fotoğraf profil kaydına bağlanmadan eski fotoğraf silinmez. Fotoğraf yükleme başarısızsa mevcut fotoğraf korunur. Bağlantı kesilmesi gibi durumlarda depoda kullanılmayan dosyalar kalabilir; uygulama normal hata durumlarında bunları temizlemeye çalışır.

Kaynak: https://supabase.com/docs/guides/storage/security/access-control
