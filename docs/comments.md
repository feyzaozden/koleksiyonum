# Yorumlar: kurulum ve teknik yapı

## Kurulum

1. Supabase SQL Editor'da yalnızca `supabase/migrations/20261105_comments.sql` dosyasını çalıştır. Önceden kullanıcı adı/fotoğraf, arkadaşlık, beğeni, bildirim ve `20261102_friend_notifications.sql` migration'ları uygulanmış olmalı. `schema.sql` dosyasını tekrar çalıştırma.
2. Yerel geliştirme sunucusunda iki arkadaş hesapla dene. Üretim için kodun ayrıca yayımlanması gerekir. Bu değişiklik SQL'i canlı ortamda kendiliğinden çalıştırmaz.
3. Bir içerik kartındaki Yorumlar bağlantısını aç. Anonim/açık yorum, cevap, tepki ve silmeyi dene. Arkadaşlığı kaldırdıktan sonra Profilim → Yorumlarım üzerinden eski yorumunu silebildiğini kontrol et.

## Veri modeli

`collection_private.item_comments` her yorumun içerik kimliğini, gerçek yazarını, metnini, anonim tercihini, tarihini ve cevap verdiği ana yorumun kimliğini tutar. `parent_id` boşsa ana yorumdur. Cevaplar tek seviyedir; başka bir cevaba cevap verilmez. Farklı içerikteki bir yoruma cevap verilemez.

`collection_private.comment_reactions` yorum + kullanıcı birleşimiyle tek oy tutar. 1 beğeni, -1 beğenmeme anlamına gelir. Aynı kişi iki ayrı oy bırakamaz; yeni seçim eskisini değiştirir, tekrar basmak kaldırır. Kendi yorumuna tepki verilemez. Kullanıcılar bu iki tabloyu doğrudan okuyamaz veya değiştiremez; RLS açık, tablo yetkileri kapalıdır.

## İşlem akışı ve yetki

Arayüz Supabase RPC çağırır. `add_item_comment` kimliği parametreden almaz; `auth.uid()` ile oturumdan bulur. İçerik sahibi veya onun kabul edilmiş arkadaşı olma şartı her okuma/yazma işleminde veritabanında kontrol edilir. Açık profil olmak yorum erişimi sağlamaz. İçerik ve arkadaşlık satırlarına transaction kilidi alınır; arkadaşlığın aynı anda kaldırılmasıyla oluşabilecek yetki yarışı sınırlandırılır.

Yorum ve cevaplarda uygulamaya özel kelime/karakter sınırı yoktur. Boş yorum hem `commentValidation.js` hem SQL fonksiyonunda reddedilir. Yorum metni HTML olarak işlenmez, React metni olarak gösterilir. Önceki sürüm SQL'i uygulanmışsa yalnızca `20261105_comments_remove_limits.sql` dosyasını çalıştır; mevcut yorumlar korunur. Sunucu/HTTP altyapısının genel istek boyutu sınırları geçerlidir.

`get_item_comments` en fazla 50 satır verir; `after_id` sonraki sayfayı, `focus_id` bildirimden hedef yorumu içeren sayfayı seçer. Anonim yorumun profil kimliği, kullanıcı adı, avatar yolu ve simgesi yanıtta NULL olur. Gerçek `author_id` hiçbir zaman genel yorum yanıtına girmez. Yalnızca kendi yorumunda `own` bilgisi ve yetkiye göre `can_delete` bulunur. Tepkiler toplam sayılar ve oturum sahibinin kendi oyu olarak döner; diğer oy verenlerin kimlikleri dönmez. Bu, yöneticiye karşı anonimlik veya metin/zaman üzerinden kimlik çıkarımının imkânsızlığı anlamına gelmez.

## Silme ve eski yorumlar

Güncel görünümde silinen yorumlar listelenmez; yer tutucu veya silinmiş yorum alıntısı gösterilmez. Önceki kurulumu güncellemek için `20261105_comments_hide_deleted.sql` uygulanır. Sayfalama yalnızca görünür yorumları sayar; alt cevapların bağlantısını korumak için metni temizlenmiş kayıt veritabanında tutulur.

`delete_item_comment` yorumu yazan kişiye veya içerik sahibine izin verir. Yazarın arkadaşlığı bitmiş olsa da kendi yorumunu silmesine izin verilir. Metin NULL yapılır, silinme zamanı yazılır ve oylar kaldırılır. Alt cevaplar korunur; silinen yazar bilgisi genel yanıtta gizlenir. `get_my_comments` yalnızca oturum sahibinin silinmemiş yorumlarını döndürür; bu nedenle arkadaşlık bitse de Yorumlarım'dan silme mümkündür. İçeriğin kendisi silinirse bağlı yorumlar ve oylar FK cascade ile silinir.

## Bildirimler ve yönetici geçmişi

Mevcut özel bildirim tablosuna comment/reply türleri eklenir. Yeni yorum içerik sahibine, cevap da ana yorum yazarına gider. Kişi kendine bildirim almaz; ana yorum yazarı aynı zamanda içerik sahibiyse iki bildirim oluşturulmaz. Cevap alıcısı artık içerik sahibinin arkadaşı değilse cevap bildirimi gönderilmez. Bildirim cevabında anonim yazar kimliği gizlenir; yorum metni bildirime kopyalanmaz. Bildirim bağlantısı yorum sayfasına gider ve yetki orada tekrar kontrol edilir.

Aktivite geçmişi kurulmuşsa yorum oluşturma/silme ve yorum tepkileri yönetici geçmişine eklenir. Yorumun tam metni audit kaydına kopyalanmaz; kimlikler ve olay bilgisi tutulur. Audit tablosu yoksa yorum özelliği yine çalışır.

## Arayüz dosyaları

- `CommentsPage.jsx`: içerik yorumları ve Yorumlarım görünümü, sayfalama, bildirim hedefi, hata/yetki durumları.
- `CommentForm.jsx`: anonim seçim, yorum/cevap gönderimi ve boş içerik kontrolü.
- `CommentDelete.jsx`: klavye odağı ve iptal davranışı olan silme onayı.
- `ItemCard.jsx`: yetkili kullanıcıya Yorumlar bağlantısı.
- `Notifications.jsx`: yorum ve cevap bildirimleri.

## Testler ve sınırlar

`tests/comments.test.js` gerçek PostgreSQL davranışını PGlite üzerinde sınar: anonim alanlar, arkadaş olmayan/açık hesap erişimi, kelime sınırı, farklı içeriğe cevap, tek seviyeli cevap, bir oy kuralı, silme yetkisi, silinmiş ana yorumun cevapları, arkadaşlık sonrası kendi yorumunu silme, bildirimler, sayfalama, migration tekrarının güvenliği ve içerik silinmesi. Tarayıcı/mobil etkileşim testi ve canlı SQL kurulumu ayrıca yapılmalıdır.

Yorum düzenleme, görsel yükleme, otomatik moderasyon ve yorum tepkisi bildirimi bu sürümün kapsamında değildir. Başarısız ağ isteğinde kullanıcı tekrar göndermeden önce listeyi yenileyebilir; başarılı kayda ait yanıtın kaybolduğu durumlarda isteğe özel idempotency anahtarı henüz yoktur.
