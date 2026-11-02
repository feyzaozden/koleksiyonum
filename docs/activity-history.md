# Yönetici aktivite geçmişi

## Gerçek giriş kayıtları

İlk aktivite migration'ından sonra `supabase/migrations/20261102_auth_activity.sql` dosyasını SQL Editor'da çalıştır. Bu ek migration Supabase `auth.sessions` tablosunda yeni oturum oluştuğunda `auth_login` kaydı oluşturur. Kullanıcı kimliği ve zaman Auth verisinden gelir; tarayıcının bildirim göndermesine veya yeni arayüzün yayımlanmasına bağlı değildir. Sayfa yenilemesi, mevcut oturumun geri yüklenmesi ve token yenilemesi yeni giriş oluşturmaz. Şifre kurtarma veya başka bir giriş yöntemi yeni oturum oluşturursa o da kaydedilir; kayıt tek başına şifre kullanıldığını iddia etmez. Başarısız giriş denemeleri için Supabase Auth günlükleri kullanılmalıdır.

Yalnızca kurulumdan sonraki yeni oturumlar kaydedilir. Çıkış yapıp yeniden giriş yaptıktan sonra `inspect_activity.sql` sorgusunda `auth_login / Giriş yapıldı (yeni oturum)` görünür. Eski oturumlar geriye dönük eklenmez. Mevcut oturumları silmez veya kullanıcıları çıkışa zorlamaz. Günlük temizliği aynı 90 günlük kurala tabidir.

Bu trigger Auth işlemiyle aynı transaction'dadır. Yerel PostgreSQL testleri ile doğrulanmıştır; canlıda kurulumdan sonra bir test hesabıyla giriş kontrol edilmelidir. Beklenmedik bir Auth veritabanı hatası olursa yalnızca bu bağlantıyı kaldırmak için `drop trigger if exists collection_audit_auth_session on auth.sessions;` çalıştırılabilir; mevcut geçmiş kayıtları silinmez.

## Kurulum

1. SQL Editor'da yalnızca `supabase/migrations/20261102_activity_history.sql` dosyasını çalıştır. Mevcut kullanıcı adı, ilerleme, arkadaşlık, beğeni ve hesap gizliliği migration'ları önceden uygulanmış olmalı. Yeni arkadaş bildirimleri migration'ı ile birlikte çalışabilir ama ona bağlı değildir.
2. Arayüz kodunu yayımla. Ziyaret kaydı için yeni kod gerekir; SQL işlem geçmişi migration uygulandığı anda başlar. Geçmiş olaylar uydurulmaz, mevcut kayıtlar topluca geçmişe kopyalanmaz.
3. `supabase/inspect_activity.sql` dosyasındaki KULLANICI_ADI değerini değiştirip sorgula. İlk sorgu kullanıcıya ait ve kullanıcıyı ilgilendiren son 500 işlemi, ikinci sorgu yaklaşık son aktiflikleri verir. Yalnızca kişinin kendi yaptığı işlemleri görmek için `where a.actor_id in (select id from target)` kullan.
4. Temizliği site kullanılmadığında da günlük çalıştırmak için Supabase'de pg_cron etkinleştirip `supabase/schedule_activity_cleanup.sql` dosyasını çalıştır. Job durumunu cron.job_run_details üzerinden kontrol et. Kurulmazsa ilk yeni aktivite kaydı sırasında günde bir temizlik yapılır; site tamamen kullanılmıyorsa temizlik bir sonraki kaydı bekler. Bu yüzden günlük job önerilir.

## Kapsam ve anlam

`collection_private.activity_history` yalnızca yönetici erişimine açıktır. Normal kullanıcılar tablodan okuyamaz, yazamaz veya silemez; hiçbir listeleme RPC'si yoktur. Son aktiflik RPC'si yalnızca oturumdaki kişinin kimliğini ve sunucu saatini kullanır. Tüm bilgiler diğer kullanıcılara kapalıdır. Yönetici veritabanı sahibi olduğundan bu kayıtlar yöneticiye karşı değiştirilemez bir kanıt deposu değildir.

| İşlem | Anlam |
| --- | --- |
| item_created / item_updated / item_deleted | İçerik oluşturuldu, değiştirildi veya silindi |
| item_progress_updated | İlerleme değişti; aynı işlemde değişen diğer alanlar ayrıntılarda bulunur |
| reaction_added / reaction_changed / reaction_removed | Tepki eklendi, değişti veya geri çekildi |
| friend_request_sent / friend_request_cancelled / friend_request_rejected | İstek, iptal veya ret |
| friendship_auto_accepted / friendship_accepted / friendship_removed | Anında arkadaşlık, kabul veya arkadaşlıktan çıkarma |
| profile_created / profile_updated / profile_deleted | Profil işlemi; biyografi, ad ve fotoğrafın tam değeri kopyalanmaz |
| site_visit | İlk görünür ziyaret veya son bildirimin üzerinden en az 30 dakika geçtikten sonraki aktivite |
| site_active | Etkileşim bildirimi; en fazla 5 dakikada bir geçmişe satır |

İşlem kayıtları değişiklikle aynı veritabanı transaction'ındadır. Hatalı/geri alınmış işlemler geçmişte başarılı görünmez. Aynı değerle güncelleme kayıt üretmez. Doğrudan API veya sunucudan gelen değişiklikler de trigger ile kaydedilir. Not metni, şifre, token, e-posta ve ziyaret URL'si tutulmaz; not/biyografi değiştiği yalnızca alan adıyla belirtilir. İçerik başlığı ve seçili durum/tarih/puan/ilerleme alanlarının önceki ve sonraki değerleri tutulur.

`actor_id` auth.uid() değeridir: service key ile film/dizi ekleyen sunucuda veya SQL Editor işlemlerinde boş olabilir. Bu durumda sahip `subject_id` ile bilinir, gerçek insan aktör varmış gibi iddia edilmez; `origin=server_or_admin` olur. Zincirleme silmeler/trigger işlemleri `cascade_or_trigger` kaynağıyla ayrılır. Hesap/ içerik silinmesi geçmiş satırlarını silmez; ilgili UUID saklanır ve kullanıcı adı artık bulunamayabilir. Hesap silme/veri silme taleplerinde bu yönetici kayıtları da ayrıca değerlendirilmelidir.

Ziyaretler `client_reported` kaynağıdır, kesin insan aktivitesi kanıtı değildir. Sekme yalnızca açık kaldığı için sürekli aktivite üretilmez. Görünür sekmede etkileşim olduğunda en fazla dakikada bir bildirim gönderilir; veritabanı da bu sıklığı sınırlar. Kimliği doğrulanmış bir istemci kendi varlık bildirimlerini otomatik gönderebilir; engelleyici veya ağ sorunu eksik kayıt oluşturabilir. Tek tek tıklama, tuş içeriği, sayfa gezintisi veya ekran kaydı yoktur. Tüm cihazlar kullanıcı başına birleştirilir. Gerçek giriş/çıkış, şifre işlemleri için Supabase Auth günlüklerini ayrıca kullan.

Saklama: 90 günden eski aktivite ve hareketsiz presence kayıtları temizlenir. Temizlik uygulama koleksiyonlarını, oylarını veya arkadaşlıklarını silmez. Gizlilik sayfasına bu işleyişi anlatan bilgi eklenmiştir; mevcut sayfa hâlâ tamamlanmış bir hukuki aydınlatma metni olarak sunulmaz.
