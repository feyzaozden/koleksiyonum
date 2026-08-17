export const TABS = {
  kitap: {
    label: 'Kitaplar',
    emoji: '📚',
    creatorLabel: 'Yazar',
    emojis: ['📖', '📕', '📗', '📘', '📙', '🔖'],
    statusLabels: { bekliyor: 'Okunacak', devam: 'Okunuyor', bitti: 'Okundu' },
    colorVar: 'kitap',
  },
  film: {
    label: 'Filmler',
    emoji: '🎬',
    creatorLabel: 'Yönetmen / Yapımcı',
    emojis: ['🎬', '🎥', '🍿', '🎞️', '🎭'],
    statusLabels: { bekliyor: 'İzlenecek', devam: 'İzleniyor', bitti: 'İzlendi' },
    colorVar: 'film',
  },
  dizi: {
    label: 'Diziler',
    emoji: '📺',
    creatorLabel: 'Yapımcı / Platform',
    emojis: ['📺', '🖥️', '📡', '🎭', '▶️'],
    statusLabels: { bekliyor: 'İzlenecek', devam: 'İzleniyor', bitti: 'İzlendi' },
    colorVar: 'dizi',
  },
}

export const AVATAR_CHOICES = ['📖', '🎬', '📺', '⚔️', '🐺', '🌙', '⭐', '🔥', '🌸', '🍀']
