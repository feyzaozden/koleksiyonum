// Yeni duyurulara benzersiz bir id ver; yayımlanmış duyuruların id'sini değiştirme.
export const ANNOUNCEMENTS = [
  {
    id: '2026-10-18-profile-privacy',
    date: '2026-10-18',
    icon: '🔓',
    title: 'Hesabının gizliliğini sen belirle',
    text: 'Profilim bölümünden hesabını açık veya gizli yapabilirsin. Açık hesabındaki içerikleri giriş yapan tüm üyeler görebilir; seni ekleyen kişiler onay beklemeden arkadaşın olur. Gizli hesapta ise arkadaşlık istekleri onayını bekler.',
  },
  {
    id: '2026-10-18-media-search',
    date: '2026-10-18',
    icon: '🎬',
    title: 'Film ve dizileri arayarak ekle',
    text: 'Eklemek istediğin film veya dizinin adını ara, sonuçlardan seç ve koleksiyonuna ekle. Başlık, yönetmen veya yaratıcı bilgisi ve yıl otomatik dolsun.',
  },
  {
    id: '2026-10-18-item-reactions',
    date: '2026-10-18',
    icon: '👍',
    title: 'Arkadaşlarının içeriklerine tepki bırak',
    text: 'Arkadaşlarının kitaplarına, filmlerine ve dizilerine beğeni veya beğenmeme bırakabilirsin. İçerik sahibi tepki sayılarını görür; kimin tepki verdiği gösterilmez.',
  },
  {
    id: '2026-10-18-item-progress',
    date: '2026-10-18',
    icon: '📖',
    title: 'Kaldığın yeri unutma',
    text: 'Kitabında kaçıncı sayfada, dizinde hangi sezon ve bölümde, filminde kaçıncı dakikada kaldığını kaydet. Toplam sayfa, sezon, bölüm veya süre bilgilerini girmek zorunda değilsin.',
  },
  {
    id: '2026-10-18-reaction-notifications',
    date: '2026-10-18',
    title: 'İçeriklerine gelen tepkilerden haberdar ol',
    text: 'Bildirimlerim bölümünden beğeni ve beğenmeme bildirimlerini görebilir, bildirime dokunarak ilgili içeriğe ulaşabilirsin. Tepki veren kişinin kimliği gizli kalır.',
  },
]

export function announcementReads(user) {
  const ids = user?.user_metadata?.announcement_reads
  return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []
}
