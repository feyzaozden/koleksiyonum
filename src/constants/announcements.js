// Yeni duyurulara benzersiz bir id ver; yayımlanmış duyuruların id'sini değiştirme.
export const ANNOUNCEMENTS = [
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
