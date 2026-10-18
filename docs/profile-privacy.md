# Hesap gizliliği

Supabase SQL Editor'da yalnızca `supabase/migrations/20261018_profile_privacy.sql` dosyasını çalıştır. Arkadaşlık ve beğeni migration'ları önceden uygulanmış olmalı. Ardından yeni arayüz yayımlanabilir.

- Mevcut ve yeni hesaplar varsayılan olarak gizlidir. Mevcut içerikler, arkadaşlıklar ve oylar korunur.
- Profilim → Hesap gizliliği seçimi Kaydet ile uygulanır.
- Açık hesabın koleksiyonunu yalnızca giriş yapmış üyeler görebilir. Anonim ziyaretçiler göremez.
- İsteği alan hesap açıksa anında karşılıklı arkadaşlık kurulur; gizliyse istek onay bekler. Gönderenin gizlilik ayarı sonucu değiştirmez.
- Gizlilik değişikliği mevcut arkadaşlıkları silmez. Hesabı açmak geçmiş bekleyen istekleri topluca onaylamaz; alıcı onları onaylayabilir veya gönderen açık hesaba Arkadaş ol düğmesiyle isteği yenileyebilir.
- Açık profillere Keşfet üzerinden ulaşılır. IMDb karşılaştırması hâlâ yalnızca arkadaş çevresini kapsar. Arkadaş olmayanlar beğeni sayılarını görebilir; oy vermek için arkadaşlık gerekir.
- İçerik erişimi yalnızca arayüzde değil RLS ile korunur. Başkasının açık profilindeki kayıtları değiştirme/silme yetkisi verilmez. Gizliye geçiş sonraki veritabanı sorgularında erişimi keser; daha önce görüntülenmiş veriyi kullanıcının hafızasından veya aldığı ekran görüntüsünden geri alamaz. Açık profil sayfası 30 saniyede bir ve pencereye dönüldüğünde yenilenir.

Kontrol: iki arkadaş olmayan hesapla açık/gizli yönlerini dene, ardından üçüncü hesapla gizliye dönen koleksiyonun kapandığını kontrol et. `tests/profilePrivacy.test.js` bu erişim kurallarını ve migration tekrarının verileri korumasını PostgreSQL üzerinde doğrular.
