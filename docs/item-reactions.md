# İçerik beğenileri

## Kurulum

Supabase SQL Editor'da yalnızca `supabase/migrations/20261013_item_reactions.sql` dosyasını çalıştır. Arkadaşlık migration'ının daha önce uygulanmış olması gerekir. Ana `schema.sql` dosyasını yeniden çalıştırma.

Yeni migration mevcut profil, içerik ve arkadaşlık kayıtlarını silmez veya değiştirmez. Ayrı oy tablosu ve iki RPC oluşturur. Tekrar çalıştırılabilir; oylar da korunur. Ardından frontend değişiklikleri yayımlanabilir. Migration olmadan içerikler görünmeye devam eder; beğeni bölümünde yükleme hatası ve tekrar deneme gösterilir.

## Davranış

- Kitap, film ve dizi kartlarında başparmak yukarı/aşağı simgesi ve toplam sayılar gösterilir.
- Yalnızca içeriğin sahibinin kabul edilmiş arkadaşları oy verebilir. Kayıt sahibi kendi kaydına oy veremez; kendi profilini görüntülediğinde de yalnızca sayaçları görür.
- Aynı kişi aynı kayıtta tek oy verebilir. Diğer düğmeye basmak oyu değiştirir; seçili düğmeye yeniden basmak oyu kaldırır.
- Oy aynı isimli tüm filmlere değil, kişinin eklediği tek koleksiyon kaydına aittir. Bir başka kişinin aynı filmi eklemesi ayrı sayılır.
- Arkadaşlık kaldırılınca erişim ve oy değiştirme sona erer. Daha önce verilmiş oylar toplamda kalır. Yeniden arkadaş olunursa kendi oyunu değiştirmek mümkündür.
- İçerik veya oy veren hesap silindiğinde ilişkili oy satırları veritabanında otomatik silinir.
- Sayaçlar sayfa açılışında, filtre/sekme değişiminde, pencereye dönüşte ve görünür sekmede 30 saniyede bir yenilenir. Oy verenin sayacı kayıt başarılı olunca güncellenir.

## Gizlilik sınırı

İçerik sahibi ve diğer kullanıcılar oy verenlerin kimliklerini uygulamadan veya tablo API'sinden okuyamaz. Tabloya `anon` ve `authenticated` erişimi yoktur; RLS açıktır. RPC yalnızca erişilebilen içerikler için toplamlar ve isteği yapan kişinin kendi oyunu döndürür. Kullanıcı kimliği parametresi kabul edilmez; oturumdan alınır.

Tek oy sınırını uygulamak için veritabanında kullanıcı kimliği tutulur. Bu nedenle oylar veritabanı yöneticisine karşı anonim değildir. Toplamlardaki değişimden, özellikle tek arkadaş olduğunda, tahmin yürütülmesini engellemez. "Kimse hiçbir şekilde öğrenemez" garantisi verilmez. Oy tablosunu istemciye açan view/policy veya Realtime yayını eklenmemelidir.

Gizlilik metni tamamlanırken oy verilerinin tutulması, sayısal paylaşım ve saklama davranışı da açıklanmalıdır. Mevcut kişisel puan/IMDb ortalaması bu oylarla değişmez.

## Kontrol

`npm.cmd test` gerçek PostgreSQL davranışını PGlite ile denetler: doğrudan tablo erişimi, arkadaş olmayanlar/bekleyen istekler, sahibin kendine oy vermesi, tekrar oy, oy değiştirme/kaldırma, yetkisiz kullanıcı, erişim kaldırma ve migration'ın tekrar uygulanması.

İki arkadaş hesapla bir kitap/film/dizi kartında oy ver; sayfayı yenile ve seçimin korunduğunu kontrol et. Sahibin ekranında yalnızca sayıları, diğer hesapta yalnızca kendi seçimini görmelisin. Mobilde iki düğme yan yana kalmalıdır.
