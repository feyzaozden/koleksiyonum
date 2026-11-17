# Bağımsız backend geçiş haritası

Bu envanter repodaki schema.sql, migration dosyaları ve frontend çağrılarından çıkarıldı.
Canlı veritabanının birebir dökümü değildir. Gerçek taşıma öncesi şema farkları ve kayıt sayıları ayrıca doğrulanacak.

| Mevcut alan | Yeni hedef / durum | Korunacak davranış |
|---|---|---|
| auth.users | accounts.users temel tablosu hazır | UUID korunmalı; e-posta benzersiz. Parola hash aktarımı henüz doğrulanmadı. |
| profiles | collection.profiles hazır | Küçük harf kullanıcı adı, ad soyad, biyografi, gizlilik, fotoğraf yolları |
| items | collection.items temel tablosu hazır | Not, puan, tarih, ilerleme, kaynak kimlikleri, kapak, müzik alanları, favori zamanı |
| friendships | collection.friendships hazır | İki yönlü tek ilişki; gizli hedef onaylı, açık hedef doğrudan arkadaşlık |
| item_reactions | Sonraki migration | Tek kullanıcı/tek oy; başkalarının kimliği API'den dönmeyecek |
| item_comments, comment_reactions | Sonraki migration | Arkadaşlık kontrolü, anonimlik, yanıt ağacı, yazar/sahip silme yetkisi |
| reaction_notifications, announcement_reads | Sonraki migration | Alıcıya özel listeleme/okundu, anonim tepki kimliğini saklama |
| app_admins, announcements, site_privacy | Sonraki migration | Admin yetkisi backend'de kontrol; duyuru/metin sürümleri |
| music_playlists, music_playlist_items | Sonraki migration | Liste sahibi, yalnız kendi müzikleri, profil görünürlüğü |
| activity_history/presence/maintenance | Sonraki migration | Yönetici erişimi, istemci bildirimi ile doğrulanmış olay ayrımı |
| daily_item_usage, item_creation_blocks | Sonraki migration | Türkiye gün sınırı, silince kotanın geri gelmemesi, hesap engeli |
| Storage profile-photos/music-covers | Ayrı dosya aktarımı | Dosya yolu + gerçek dosya; yetkili okuma/yazma, yedekleme |

## Yetkilendirme planı

Eski auth.uid() çağrısı veya Supabase JWT'si yeni sistemde otomatik geçerli değil.
Yeni oturum middleware'i kimliği doğrulayacak; istek gövdesindeki user_id güvenilir sayılmayacak.
Profil görünürlüğü: sahibi, kabul edilmiş arkadaşı veya oturum açmış kullanıcı için açık hesap.
Yorum yazma: açık hesap olması yeterli değil, sahibi/arkadaşı olmalı.
Voter/anonim yazar/admin bilgileri doğrudan tablo JSON'u olarak istemciye gönderilmeyecek.

İlk migration tablo bütünlüğünü kurar; henüz tam iş kurallarını uygulamaz.
Runtime collection_app rolüne bu tablolarda erişim verilmedi; RLS açık ve politikalar henüz yok.
Dolayısıyla yanlışlıkla açık CRUD API oluşmaz. Oturum ve yetkili repository katmanı test edilmeden grant eklenmeyecek.
Günlük 100 sınırı, otomatik dedupe hesaplama, gelecekte tarih engeli, ilerleme doğrulaması,
4 favori sınırı, bildirim ve aktivite trigger'ları sonraki aşamalarda ayrıca taşınacak.

## Taşıma öncesi çözülmesi gerekenler

- Eski category alanlarında Roman/Edebiyat gibi türler görüldü. Bunlar kitap olarak otomatik dönüştürülmeyecek;
  önce raporlanacak, tür bilgisi korunarak eşleme kararlaştırılacak.
- Eski tekrar kayıtlar ve geçersiz alanlar doğrudan yeni kısıtlara uymayabilir. Ayrı staging alanında raporlanmalı.
- 4'ten fazla eski favori otomatik silinmeyecek.
- accepted_at eski tabloda bulunmayabilir; geçmiş tarih uydurulmayacak, NULL kalabilecek.
- Başlangıç şeması import garantisi değildir. UUID/ID, zaman dilimi, sequence sayaçları, parola hashleri,
  dosyalar ve bütün dış anahtarlar kopya veriyle doğrulanacak.
- Kullanıcı adı oluşturma/normalizasyon ve şifreleme bir sonraki kimlik doğrulama aşamasında yapılacak.

## Migration kullanımı

Bu dosyalar Supabase SQL Editor'a yapıştırılmaz. Yalnızca yerel bağımsız PostgreSQL'e uygulanır:

```powershell
docker compose -f compose.backend.yaml --env-file .env.backend.local --profile tools run --rm --build migrate
```

Her SQL dosyası transaction içinde çalışır. Başarılı sürümler backend_meta.migrations tablosuna
checksum ile kaydolur; aynı komut tekrarında atlanır. Uygulanmış dosya değiştirilmez, yeni numaralı dosya eklenir.
Migration admin kimliğiyle tek seferlik çalışır; normal backend bu admin parolasını almaz.
Yerel şema şu anda boş: gerçek kullanıcı veya koleksiyon aktarılmadı.
