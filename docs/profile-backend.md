# Profil bilgilerini kendi backend'imizde düzenlemek

Canlı site Supabase'te çalışmaya devam eder. Bu çalışma yalnızca deneme
sunucusundaki hesapların profilini günceller; eski kullanıcılar aktarılmadı.

`/collection-app` sayfasında Profilim düğmesi pencere açar. Kullanıcı adı,
ad soyad ve biyografi düzenlenebilir. Fotoğraf, hesap gizliliği ve şifre
değiştirme bu aşamaya dahil değildir.

- `src/independent/ProfileDialog.jsx`: Mevcut bilgileri yükler; formu gösterir.
  Büyük ASCII harflerini küçültür. Hata olursa formdaki yazıları korur.
- `backend/src/items.js`: `/api/collection/profile` GET ve PATCH isteklerini
  karşılar. Çerezi ve istek kaynağını kontrol eder; kullanıcı kimliği istemez.
- `backend/migrations/007_profile_details.sql`: Oturumdan kullanıcının kimliğini
  belirler. Yalnızca kendi profilinin üç alanını değiştirmesine izin verir.
  Kullanıcı adı 3–30 karakter, ad soyad 1–80, biyografi en fazla 160 karakterdir.
  Kullanıcı adı harfle başlar; a–z, 0–9, alt çizgi ve nokta kullanılabilir.
- `tests/independentProfile.test.js`: Ayrı test veritabanında oturum, yetki,
  benzersizlik, alan sınırları ve eski sürümle kaydetme kontrollerini sınar.

Örnek: “Kaydet” → PATCH → oturum doğrulaması → SQL alan/benzersizlik kontrolü
→ güncel profil → React ekranındaki başlık ve biyografinin yenilenmesi.

`revision` profilin sürümüdür. İki sekmeden aynı profili düzenlersen eski sürüm
yenisini ezmez; güncel profili tekrar yüklemen istenir. Bu yükleme düğmesi mevcut
taslağı bırakacağını açıkça belirtir. Kaydetme sürerken ikinci kayıt engellenir.

SQL dosyası deneme dağıtımında otomatik uygulanır. Supabase'e yapıştırılmaz.
