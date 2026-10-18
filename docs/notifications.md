# Tepki bildirimleri

Supabase SQL Editor'da yalnızca `supabase/migrations/20261018_reaction_notifications.sql` dosyasını çalıştır. Önceden beğeni migration'ı uygulanmış olmalı. Mevcut kayıtlar ve oylar silinmez; geçmiş oylar için topluca bildirim oluşturulmaz.

Sonrasında iki arkadaş hesapla test et: biri diğerinin kitabına, filmine veya dizisine tepki bıraksın. İçerik sahibi Bildirimlerim bölümünde bildirimi görür. Kapalıyken sayı 30 saniyede bir ve pencereye dönüldüğünde güncellenir; açıldığında liste yenilenir. Liste 30'ar kayıt yüklenir.

Bir kişi/içerik çifti tek bildirim üretir. Tepki değişirse mevcut bildirimin ifadesi değişir; okunmuş bildirim yeniden okunmamış olmaz. Tepki kaldırılırsa geçmiş bildirim korunur. Yeniden ekleme bildirim sayısını artırmaz.

Bildirim tıklaması kategoriyi seçer, arama/durum filtrelerini temizler ve karta odaklanır. İçerik silinirse bildirim geçmişi korunur ve artık mevcut olmadığı belirtilir. Yeni kayıt/silme yetkisi kullanıcılara açılmaz; yalnızca sahibine özel listeleme ve okundu işaretleme RPC'leri vardır. Tepki veren kimliği özel tabloda yöneticinin erişimine açıktır fakat istemci yanıtında bulunmaz.

Bu site içi bildirimdir; e-posta veya telefon push bildirimi göndermez. SQL dosyasının canlı ortamda çalıştırılması ve kodun yayımlanması ayrı adımlardır.
