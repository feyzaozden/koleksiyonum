# Film ve dizi araması — ilk adım

Film sekmesinde bir ad yazılır. 400 ms yazma molasından sonra TMDB'de Türkçe arama yapılır. Sonuçlar afiş, ad ve yıl ile listelenir. Bir sonuç seçildiğinde detayları ve yönetmeni alınır; mevcut formun yalnızca başlık, yönetmen ve yıl alanları dolar. Kullanıcı + Ekle ile kaydeder. Kişisel puan, durum, not, tarihler ve ilerleme TMDB'den alınmaz.

Bu ilk sürüm otomatik form doldurmadır. Yeni tablo veya SQL migration gerektirmez; mevcut kayıtları değiştirmez. Afişler yalnızca arama sonuçlarında gösterilir. TMDB kimliği henüz veritabanına kaydedilmez; ortak katalog/eşleştirme sonraki adımdır. Kitap araması bu sürüme dahil değildir. Elle ekleme kullanılmaya devam eder.

Dizi sekmesi de aynı akışı kullanır. `/api/series`, TMDB'nin `/search/tv` ve `/tv/{id}` uçlarına bağlanır. `name` başlığa, `first_air_date` ilk yayın yılına, `created_by` yaratıcı alanına aktarılır. Bilgi eksikse elle tamamlanabilir. Platformların ülkeye göre değişen yayın hakları bu alanın yerine kullanılmaz. Sezon/bölüm ilerlemesi, puan, not ve izleme tarihleri otomatik değiştirilmez. Aynı `TMDB_READ_ACCESS_TOKEN` kullanılır; yeni anahtar gerekmez.

## 1. TMDB erişimini oluştur

1. https://www.themoviedb.org/signup üzerinden kendi hesabını oluştur ve e-postanı doğrula.
2. Hesap ayarlarındaki API bölümünü aç: https://www.themoviedb.org/settings/api
3. API erişimi için başvur. Kullanım amacını doğru belirt. Örnek uygulama adı: Koleksiyonum; adres: https://koleksiyonum.com.tr; açıklama: Kullanıcıların filmleri arayıp kişisel izleme koleksiyonlarına eklediği uygulama.
4. Başvuru tamamlanınca **API Read Access Token** değerini al. Bu uygulama API Key (v3 auth) alanını değil, uzun okuma erişim token'ını kullanır.
5. Token'ı sohbete veya kaynak koda yapıştırma. Aşağıdaki ortam değişkeni alanlarına yaz.

TMDB'nin ticari olmayan kullanımında kaynak gösterimi gerekir. Gelir amaçlı kullanım için ticari lisans koşullarını değerlendir: https://developer.themoviedb.org/docs/faq
Resmi logo public/tmdb.svg içinde, kaynak ve zorunlu bildirim sayfa altındaki Kaynaklar bölümünde bulunur.

## 2. Bilgisayarında etkinleştir

Proje kökünde `.env.local` oluştur veya varsa mevcut içeriğine şu satırı ekle:

```dotenv
TMDB_READ_ACCESS_TOKEN=buraya_kendi_okuma_tokenini_yaz
```

Başına **VITE_ ekleme**. VITE_ ile başlayan değerler tarayıcıya açılır; bu anahtar yalnızca sunucuda kalmalıdır. `.env.local` Git tarafından yok sayılır. Mevcut `.env` içindeki Supabase ayarlarını koru.

Çalışan terminalde Ctrl+C ile sunucuyu durdur; `npm.cmd run dev` ile yeniden başlat. Terminalde yazan Local adresine gir. Giriş yaptıktan sonra Film sekmesinde Yıldızlararası ara, sonucu seç, alanları kontrol edip + Ekle'ye bas. Başlık/yönetmen/yıl eksikse elle tamamlayabilirsin. Gelecek yıllara ait sonuçlar mevcut yıl kuralıyla uyumlu olarak elenir; tarih/yıl bilgisi eksik içerikler elle tamamlanabilir.

## 3. Canlı ortamda etkinleştir

Vercel > proje > Settings > Environment Variables altında `TMDB_READ_ACCESS_TOKEN` ekle. Değer olarak aynı token'ı kullan. İlgili Production/Preview ortamlarını seç. Mevcut `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değişkenlerinin bu ortamlarda da tanımlı olduğundan emin ol. Yeni kodun deployment'ı gerekir; mevcut deployment'a sadece değişken eklemek yetmez. Kod yayınlandıktan sonra gerekirse Redeploy yap.

Bu çalışma kendiliğinden push/deploy yapmaz. Anahtar olmadan film araması açıklayıcı mesaj gösterir; elle içerik eklemek çalışır.

## Kodun akışı

- `src/components/MovieSearch.jsx`: yazma beklemesi, sonuçlar, seçim, eski isteklerin iptali, hata/boş sonuç/elle ekleme.
- `src/lib/movieApi.js`: mevcut Supabase oturum token'ı ile kendi `/api/movies` adresimize istek.
- `api/movies.js`: Vercel sunucu fonksiyonunun giriş noktası.
- `api/series.js`: dizi araması için Vercel giriş noktası; aynı sunucu mantığını ayrı önbellekle kullanır.
- `server/movies.js`: Supabase üzerinden oturum doğrulaması, TMDB'ye sabit adreslerden istek, Türkçe hata mesajları, 8 saniyelik istek zaman aşımı ve sınırlı 5 dakikalık bellek önbelleği. Önbellek her sunucu örneğine aittir, kalıcı veya dağıtık değildir.
- `vite.config.js`: aynı sunucu fonksiyonunu yerel geliştirme ve preview sunucusuna bağlar; ayrı backend terminali gerekmez.
- `vercel.json`: API isteklerini SPA HTML yönlendirmesinin dışında tutar.
- `AddForm.jsx`: seçilen bilgileri forma aktarır. Kaydetme hatasında alanlar korunur.

## Kontrol listesi

- Film ara/seç/kaydet; sayfayı yenileyince kaydın kaldığını doğrula.
- Dizi sekmesinde Leyla ile Mecnun ara; seçimden sonra başlık, yaratıcı ve ilk yayın yılını kontrol et. Puan/not/tarih alanlarının korunmasını ve kitap sekmesinin elle eklemeye devam etmesini doğrula.
- Sonuç yokken ve API ulaşılamazken elle eklemeyi dene.
- Yazarken hızlıca sorguyu veya kategoriyi değiştir: eski sonuçlar yeni forma gelmemeli.
- Arama alanında Enter tuşu koleksiyona kayıt eklememeli.
- Yanlış/eksik token anlaşılır hata vermeli; token hata mesajında görünmemeli.
- Mobilde sonuç listesi kendi içinde kaymalı; uzun isimler yatay taşmamalı.
- Canlıda `/api/movies` isteği JSON dönmeli; giriş yapılmadan 401 dönmeli. `/profile` gibi doğrudan sayfa bağlantıları açılmalı.

Resmi belgeler: https://developer.themoviedb.org/reference/search-movie ve https://developer.themoviedb.org/reference/movie-details
