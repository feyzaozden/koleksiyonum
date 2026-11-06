# Film ve dizi afişleri

Yayımlamadan önce `supabase/migrations/20261106_item_posters.sql` dosyasını SQL Editor'da çalıştır. Mevcut içerikler korunur; yalnızca isteğe bağlı poster_path alanı eklenir.

Yeni TMDB kayıtlarının afiş yolu sunucuda TMDB yanıtından alınır. Görseller TMDB görsel sunucusundan yüklenir; Supabase Storage kullanılmaz. Manuel içerikler ve afişi bulunamayan kayıtlar mevcut simgeyle gösterilir.

Eski TMDB kayıtları, kaynak kimlikleri sayesinde ekrana yaklaştıklarında mevcut oturum doğrulamalı katalog API'sinden afişlerini getirir. Bu işlem eski kayıtları değiştirmez. Tarayıcı oturumu boyunca sonuçlar paylaşılır, eşzamanlı istek sayısı üçle sınırlıdır. Sayfa tamamen yeniden açılınca eski kayıtlar için tekrar bilgi istenebilir. Kaynak kimliği bulunmayan manuel kayıtlar başlık benzerliğiyle otomatik eşleştirilmez.
