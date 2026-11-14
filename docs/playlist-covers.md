# Müzik liste kartları

Supabase SQL Editor'da `supabase/migrations/20261114_playlist_covers.sql` dosyasını çalıştır.
Önceden müzik kurulumu yapılmış olmalı. Bu dosya mevcut şarkıları ve listeleri silmez.

Müzik ilk açıldığında Listem/Listesi kartı ve oluşturulma sırasıyla diğer listeler görünür.
Kart seçilince şarkılar, arama ve sıralama açılır. Çalma listeleri bağlantısıyla kartlara dönülür.
Liste açıkken sahibi “Kapak ve açıklama” düğmesiyle JPG/PNG/WebP (en fazla 5 MB) yükleyebilir.
Listem'in açıklama ve kapak yolu profiles tablosunda; diğerlerininki music_playlists tablosunda tutulur.
Fotoğraflar özel music-covers Storage bucket'ındadır. Sahibi, arkadaşları ve açık profiller için oturum açmış kullanıcılar erişebilir.
Yeni yükleme sonrasında kayıt başarısızsa yeni dosya temizlenir. Eski kapaklar veri kaybını önlemek için otomatik silinmez.
Storage yedeklerine bu bucket'ı da dahil et.

Kontrol: `node --test tests/playlistCovers.test.js tests/musicDatabase.test.js`, `npm.cmd run build`.
