# Koleksiyon backend'i — bir isteğin yolculuğu

Bu adım yalnız bağımsız test sistemine aittir. Canlı Supabase verileri aktarılmaz.
Önce /auth-test üzerinden e-postası doğrulanmış test hesabına giriş yapılır, sonra /collection-test açılır.
Yerelde /auth-lab hesabını doğruladıktan sonra http://localhost:3001/collection-test kullanılabilir.

## Bu adımda neler var?

Kitap, film, dizi ve müzik için manuel ekleme; kendi kayıtlarını sayfalı listeleme; düzenleme ve onaylı silme.
Başlık, yazar/yönetmen/sanatçı, yıl, not, durum, tarihler ve puan desteklenir.
Müzikte durum seçimi gösterilmez; veritabanındaki uyumluluk alanı bekliyor olarak tutulur.
Tarihli kayıtlar bitiş (yoksa başlangıç) tarihine göre önce, tarihsizler eklenme zamanına göre sonra gelir.

Bu bir geçiş deneme ekranıdır; mevcut ana arayüzü değiştirmez. Katalog araması, afiş, ilerleme JSON'u,
favoriler, arkadaşların içerikleri, sosyal işlemler ve aktivite geçmişi henüz bu API'ye bağlı değildir.
İsteklerde source_id, user_id, progress veya featured_at gibi desteklenmeyen alanlar reddedilir.

## Örnek: bir kitap eklerken

1. Tarayıcıda başlık/yazar alanlarını doldurup Kaydet'e basarsın.
2. `backend/pages/collection-test.js` formu JSON'a çevirir, POST /api/collection isteği yollar.
3. Tarayıcı HttpOnly oturum çerezini kendisi ekler. JavaScript bu çerezi okumaz; gövdeye kullanıcı kimliği yazılmaz.
4. `backend/src/app.js` adresi karşılar ve isteği `items.js` dosyasına yönlendirir.
5. `backend/src/items.js` HTTP yöntemi, isteğin kaynağı, JSON boyutu, alan adları ve tarih biçimini kontrol eder.
6. Oturum anahtarının SHA-256 özetini hesaplar; SQL'e parametrelerle yollar. Başlık SQL komutuna birleştirilmez.
7. `collection.write_own_item` oturumdan kullanıcıyı bulur. E-posta doğrulanmamış, oturum süresi dolmuş veya hesap kapalıysa işlem durur.
8. PostgreSQL aynı hesabın yazma işlemlerini kilit altında sıraya alır. Günlük kotayı artırma ve içeriği ekleme aynı transaction'dadır.
9. Trigger tarih, metin ve yıl kurallarını kontrol eder; normalleştirilmiş başlık/yazar/yıl üzerinden tekrar anahtarı üretir.
10. Hata yoksa kayıt oluşur. API 201 ve yeni kaydı döndürür; tarayıcı listeyi yeniler.

Başarısız ekleme günlük kotayı tüketmez. Başarılı ekleme sonradan silinse bile o günün kullanımından düşmez.
Günlük 100 sınırı Türkiye saatine göre hesaplanır. Kalan hak bilgisi arayüzde gösterilmez.

## Dosyaları nasıl bulurum?

| Dosya | Görevi | Örnek değişiklik |
|---|---|---|
| backend/pages/collection-test.html | Deneme ekranının alanları | Alan etiketi veya açıklaması |
| backend/pages/collection-test.js | Kaydet, düzenle, sil ve listeleme davranışı | Silme onay metni |
| backend/src/app.js | Adrese göre istekleri yönlendirme | Yeni API yolunu bağlamak |
| backend/src/items.js | HTTP doğrulaması, oturum özeti ve hata yanıtları | Yeni alanı açıkça kabul etmek |
| backend/migrations/005_collection_crud.sql | Yetkili SQL fonksiyonları, günlük sayaç, doğrulama trigger'ı | İş kuralının ilk kurulumu |
| tests/independentItems.test.js | İki hesapla erişim/kurallar testi | Yeni hata senaryosunu test etmek |
| deploy/staging/Caddyfile | Dışarı açılan adresler | Yeni test sayfasını sunucuya yönlendirmek |

Uygulanmış 005 SQL dosyasını değiştirme. Veritabanı kuralını sonradan değiştireceksen 006_...sql gibi yeni migration oluştur.
Bu dosyaları Supabase SQL Editor'a yapıştırma. CI yalnız yeni sunucunun staging PostgreSQL'ine uygular.

## API sözleşmesi

| İşlem | İstek | Sonuç |
|---|---|---|
| Liste | GET /api/collection?category=kitap&limit=20&offset=0 | items ve total |
| Ekle | POST /api/collection | 201, item |
| Düzenle | PATCH /api/collection/123 | 200, item; gövdede revision gerekli |
| Sil | DELETE /api/collection/123 | 200; gövdede revision gerekli |

Örnek ekleme gövdesi:

```json
{"category":"kitap","title":"Örnek Kitap","creator":"Örnek Yazar","year":"2020","status":"bekliyor","note":null,"start_date":null,"end_date":null,"rating":null}
```

`revision`, kaydın sürüm sayısıdır. İlk kayıt 1, ilk düzenleme 2 olur.
Başka sekme kaydı değiştirmişken revision=1 ile düzenleme/silme yapılırsa 409 döner; kullanıcı listeyi yeniler.
Başka hesabın numarasını denemek 404 döndürür, o kaydın varlığı açıklanmaz.
Oturum yoksa 401, farklı kaynaktan yazma isteğinde 403, veri hatasında 400, kota dolunca 429 döner.
Backend DB rolüne doğrudan tablo okuma/yazma yetkisi verilmez; yalnız üç dar SQL fonksiyonu çağrılabilir.

## Test

```powershell
node --test tests/independentItems.test.js
```

Test veritabanı PGlite ile bellekte açılır; canlı veya staging kullanıcılarına dokunmaz.
Testler: iki hesap izolasyonu, sahte user_id/source, CSRF, geçersiz/ileri tarih, tekrar kayıt,
puan, sıralama, sürüm çakışması, silince kotanın korunması, kapalı hesap ve doğrudan tablo erişim yasağı.
Günlük sınır testi kullanım sayacını test veritabanında 99'a getirir, 100. eklemenin başarılı ve 101.'nin engelli olduğunu denetler.
