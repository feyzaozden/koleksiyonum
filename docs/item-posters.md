# Film ve dizi afişleri

Eski manuel kayıtların eşleştirilmesi için ayrıca `20261106_link_item_poster.sql` çalıştırılır. Kayıt sahibi Afiş seç düğmesinden TMDB sonucunu seçip onaylar. Sunucu oturum sahibini ve TMDB afişini doğrular; yalnızca sunucu rolüne açık RPC mevcut satırın kaynak kimliğini ve afiş yolunu günceller. Diğer alanlar ve ilişkili yorum/beğeni kayıtları değişmez. Aynı yapımın mevcut koleksiyondaki başka bir kayda bağlanması benzersiz kaynak kuralıyla engellenir. Eşleştirilmiş kayıt farklı yapıma yeniden bağlanamaz.

Yayımlamadan önce `supabase/migrations/20261106_item_posters.sql` dosyasını SQL Editor'da çalıştır. Mevcut içerikler korunur; yalnızca isteğe bağlı poster_path alanı eklenir.

Yeni TMDB kayıtlarının afiş yolu sunucuda TMDB yanıtından alınır. Görseller TMDB görsel sunucusundan yüklenir; Supabase Storage kullanılmaz. Manuel içerikler ve afişi bulunamayan kayıtlar mevcut simgeyle gösterilir.

Eski TMDB kayıtları, kaynak kimlikleri sayesinde ekrana yaklaştıklarında mevcut oturum doğrulamalı katalog API'sinden afişlerini getirir. Bu işlem eski kayıtları değiştirmez. Tarayıcı oturumu boyunca sonuçlar paylaşılır, eşzamanlı istek sayısı üçle sınırlıdır. Sayfa tamamen yeniden açılınca eski kayıtlar için tekrar bilgi istenebilir. Kaynak kimliği bulunmayan manuel kayıtlar başlık benzerliğiyle otomatik eşleştirilmez.
