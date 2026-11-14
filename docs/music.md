# Müzik ve çalma listeleri

## YouTube'dan doğrudan şarkı ekleme

Mevcut müzik kurulumu üzerine yalnızca `supabase/migrations/20261114_youtube_music.sql` dosyasını SQL Editor'de çalıştır. Mevcut içeriklere dokunmaz. Yeni API anahtarı gerekmez; mevcut sunucu `YOUTUBE_API_KEY` ayarı kullanılır. Kodun canlıya dağıtılması gerekir.

Yeni ekle ekranında **YouTube’da ara** (varsayılan) veya **Müzik kataloğu** seçilebilir. YouTube araması 15 sonuç getirir; **Daha fazla sonuç** ile devam edilir. YouTube kaydı başlık, kanal ve video küçük resmiyle eklenir; albüm ve çıkış yılı tahmin edilmez. Seçilen video dinleme için de kaydedilir. İçerik mevcut yorum, tepki, çalma listesi ve öne çıkarma yollarını kullanır.

Aynı YouTube video kimliği aynı hesapta tekrar eklenemez. MusicBrainz kaydı ile farklı YouTube yüklemelerinin aynı eser olduğunu otomatik tespit etmiyoruz. Video yayıncı kısıtı, yaş/ülke kısıtı, silinme veya API kotası nedeniyle erişilemeyebilir; YouTube sitesindeki her sonuç API aramasında çıkacak diye bir garanti yoktur.

## Kurulum sırası

1. Google Cloud Console (https://console.cloud.google.com/) içinde bir proje oluştur veya mevcut projenı seç.
2. **APIs & Services → Library → YouTube Data API v3 → Enable**.
3. **Credentials → Create credentials → API key**. Anahtarın **API restrictions** bölümünü **YouTube Data API v3** ile sınırla. Anahtar sunucudan çağrıldığı için tarayıcı/HTTP referrer kısıtı kullanma; sabit çıkış IP'si varsa IP kısıtı uygulanabilir.
4. Projenin `.env.local` dosyasına `YOUTUBE_API_KEY=...` ekle. `VITE_` öneki ekleme; anahtarı Git'e veya mesaja koyma. Diğer mevcut env satırlarını koru.
5. Supabase **SQL Editor → New query** içinde yalnızca `supabase/migrations/20261113_music.sql` dosyasının tamamını çalıştır. Önceki afiş eşleştirme ve profil gizliliği migration'ları kurulu olmalı. `schema.sql` dosyasını tekrar çalıştırma. Yeni migration içerik silmez; yeni sütunlar, tablolar, indeksler ve erişim kuralları ekler. Yeni değişiklik öncesinde güncel yedek al.
6. Terminalde çalışan geliştirme sunucusunu Ctrl+C ile durdur; `npm.cmd run dev` ile yeniden aç. Terminalin yazdığı Local adresine git.
7. Canlıya geçerken Vercel **Project → Settings → Environment Variables** bölümüne `YOUTUBE_API_KEY` ekle (Production; test dağıtımları için Preview da seçilebilir). Ardından yeni deployment/redeploy gerekir. `.env.local` Vercel'e otomatik aktarılmaz.

MusicBrainz/Cover Art Archive için ek program, üyelik veya API anahtarı gerekmiyor. Supabase sunucu anahtarı mevcut film ekleme servisiyle aynı şekilde kullanılır.

## Kullanım

- Müzik → Yeni ekle → şarkı/sanatçı ara. Albüm ve sanatçıyı kontrol ederek sonucu seç. Puan/not isteğe bağlı. Kaydedilen şarkı her zaman Şarkılarım'a eklenir.
- Çalma listesi oluştur → Şarkı ekle / listeyi düzenle → Şarkılarım'daki şarkıları işaretle. Aynı şarkı birden fazla listede bulunabilir.
- Listeyi silmek şarkıyı silmez. Şarkıyı Şarkılarım'dan silmek o şarkının tüm liste bağlantılarını da kaldırır.
- Dinle → ilk kez video seç. Şarkının sahibi seçerse doğrulanan YouTube video kimliği kaydedilir. Profil ziyaretçisinin seçimi yalnızca o oynatıcı oturumu için geçerlidir.
- Listeyi dinle mevcut görünümdeki şarkıları sırayla açar; Önceki/Sonraki ile geçilebilir. Video bittiğinde sıradakine geçilir. Henüz video eşleştirilmemiş şarkıda seçim gerekir. Tarayıcı otomatik oynatmayı engellerse görünür YouTube oynatıcısındaki oynat tuşunu kullan.
- Oynatıcı penceresini kapatınca ses durur. Sekmeler/rotalar arasında arka planda kesintisiz müzik hizmeti uygulanmamıştır.
- YouTube gömmeyi kapatmışsa, video silinmişse veya ülke/yaş kısıtı varsa başka video seçilebilir. Hiçbir sağlayıcı için her şarkının her cihazda tam oynatılacağı garanti edilemez.

## Teknik yapı

- `server/music.js`: oturum doğrulamalı MusicBrainz arama, kayıt doğrulama, YouTube arama ve video eşleştirme. `api/music.js` Vercel'e, `vite.config.js` yerel sunucuya bağlar.
- Kaynak verisi kayıt sırasında tekrar sunucuda doğrulanır. İstemciden gelen kullanıcı kimliği, başlık, kapak veya video metadata'sı güvenilir kabul edilmez. Albümün seçilen kayda ait olduğu kontrol edilir.
- `items` tablosuna `muzik` kategorisi ile `music_recording_id`, `music_release_id`, `album`, `duration_ms`, `youtube_id` eklenir. TMDB'nin sayısal `source_id` alanı değişmez.
- `(user_id, music_recording_id)` benzersiz indeksi aynı kaydın tekrar eklenmesini engeller. Günlük 100 sınırı ve mevcut içerik doğrulamaları müzik için de geçerlidir.
- `music_playlists` listeyi, `music_playlist_items` liste–şarkı bağlantısını tutar. RLS açık/gizli profil ve arkadaşlık erişimini uygular. Listeyi yalnızca sahibi değiştirebilir; sadece kendi müziklerini ekleyebilir. Diğer kullanıcıların şarkılarına bağlantı eklenemez.
- Müzik aynı `items.id` yapısını kullandığı için yorumlar, anonim tepkiler ve bildirimler mevcut yetkilendirme yollarını kullanır.
- `MusicPlayer.jsx` resmî YouTube IFrame API kullanır. Görünür video gizlenmez, ses çıkarılıp yeniden barındırılmaz. API anahtarı tarayıcıya gönderilmez.
- MusicBrainz istekleri sunucu örneği içinde en az 1,1 saniye aralıklı ve kısa süreli önbelleklidir. Çok sayıda serverless örneği aynı anda kullanıldığında bu global bir kota garantisi değildir; trafik büyürse ortak önbellek/kuyruk gerekir.

## Yayın öncesi kontrol

1. Türkçe ve yabancı birer şarkı ara, albüm ve kapağı kontrol et; kapaksız kayıt simgeyle gösterilir.
2. Kaydet, yenile; not, puan, kapak korunmalı. Aynı şarkıyı tekrar ekleme reddedilmeli.
3. İki çalma listesi oluştur; aynı şarkıyı ikisine ekle. Birinden çıkar ve bir listeyi sil: Şarkılarım'daki şarkı korunmalı.
4. Dinle, video seç, kapat ve yeniden aç. Sahip tarafından seçilen video korunmalı. Telefonda oynat/duraklat ve sonraki şarkıyı dene.
5. Arkadaş hesabıyla yorum ve tepki bırak; bildirimleri kontrol et. Arkadaş olmayan hesap gizli profil listelerini görememeli. Açık profil yalnızca giriş yapmış kullanıcılara görünür.
6. Google Cloud'da API kota kullanımını izle. MusicBrainz ticari olmayan API kullanımını ücretsiz sunar; gelir modeli eklenirse ticari kullanım şartlarını ayrıca değerlendir.

Oynatıcı yüklenirken YouTube'a, kapak yüklenirken Cover Art Archive'a bağlantı kurulur. Yayındaki gizlilik metninin üçüncü taraf hizmetler bölümünü bu hizmetlerle güncel tut. Veritabanındaki düzenlenebilir gizlilik metni bu değişiklikle otomatik değiştirilmez.

Resmî kaynaklar:
- https://musicbrainz.org/doc/MusicBrainz_API
- https://musicbrainz.org/doc/Cover_Art_Archive/API
- https://developers.google.com/youtube/data/getting-started
- https://developers.google.com/youtube/iframe_api_reference
