# Duyuru yayımlama

`src/constants/announcements.js` listesinin başına benzersiz `id`, ISO `date`, `title` ve `text` içeren bir duyuru ekle. Kod canlıya yayımlandığında tüm üyeler duyuruyu Bildirimlerim panelinde görür; yeni üyeler de mevcut duyuruları okuyabilir.

Okunmamış duyurular zil sayacına dahil edilir. Okudum düğmesi o kullanıcının Supabase Auth metadata alanındaki `announcement_reads` listesine duyuru kimliğini kaydeder. Başka kullanıcıların okunma durumu etkilenmez. Aynı hesapla başka cihazda oturum yenilendiğinde kayıt taşınır. Yeni SQL kurulumu veya ayrı e-posta gönderimi gerekmez. Okunan kart panelde geçmiş duyuru olarak kalır.

Yayımlanmış bir duyurunun id değerini değiştirme; değiştirmek onu yeni duyuru sayar. Bu metadata yalnızca kişisel okunma tercihi içindir; yetki veya güvenlik kararı için kullanılmaz.
