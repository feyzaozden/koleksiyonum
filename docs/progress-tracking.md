# İlerleme takibi

Mevcut Supabase projesinde yalnızca `supabase/migrations/20260929_item_progress.sql` dosyasını SQL Editor üzerinden çalıştırın. Ana şemayı veya eski migration dosyalarını yeniden çalıştırmayın. Bu dosya kayıtları silmez; items tablosuna boş varsayılan değerli progress alanını ve geçerlilik kontrolünü ekler. Önce SQL, sonra uygulama yayını yapılmalıdır.

Karttaki **İlerlemeyi güncelle** düğmesi kitapta sayfa, filmde dakika, dizide sezon ve bölüm girişini açar. Toplamlar isteğe bağlıdır. Dizilerin her sezonunun bölüm toplamı ayrı saklanır. Sadece toplam girmek durumu değiştirmez; ilk ilerleme girişi bekleyen kaydı devam ediyor durumuna geçirir. Başlangıç tarihi otomatik doldurulmaz.

**Bölümü bitirdim** sıradaki bölüme geçirir ve 10 saniye Geri al seçeneği gösterir. Bilinen son bölümde ilerleme toplamı aşmaz; sonraki sezona geçme işlemi güncelleme penceresinde onaylanır. Sezon sayısı bilinmiyorsa kullanıcı karar verir. **Bitirdim / Diziyi bitirdim** bitiş tarihini düzenleyebileceğiniz onay penceresini açar. Kitap ve filmde toplam biliniyorsa tamamlandığında ilerleme toplama eşitlenir.

Kontrol: üç kategori için toplamlı/toplamsız kayıt, sezon değiştirme ve geri dönüş, tamamlamadan vazgeçme, farklı hesapla arkadaşın ilerlemesini görüp değiştirememe, mobil pencere ve geri alma. Mevcut kayıtların ilerlemesi girilene kadar boş kalır. Bu özellik tarih, başlık veya puanları geriye dönük değiştirmez.
