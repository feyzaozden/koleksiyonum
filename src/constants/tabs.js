export const TABS = {
  kitap: {
    label: 'Kitap',
    emoji: '📚',
    creatorLabel: 'Yazar',
    emojis: ['📖', '📕', '📗', '📘', '📙', '🔖'],
    statusLabels: { bekliyor: 'Okunacak', devam: 'Okunuyor', bitti: 'Okundu' },
    colorVar: 'kitap',
  },
  film: {
    label: 'Film',
    emoji: '🎬',
    creatorLabel: 'Yönetmen / Yapımcı',
    emojis: ['🎬', '🎥', '🍿', '🎞️', '🎭'],
    statusLabels: { bekliyor: 'İzlenecek', devam: 'İzleniyor', bitti: 'İzlendi' },
    colorVar: 'film',
  },
  dizi: {
    label: 'Dizi',
    emoji: '📺',
    creatorLabel: 'Yaratıcı / Yapımcı',
    emojis: ['📺', '🖥️', '📡', '🎭', '▶️'],
    statusLabels: { bekliyor: 'İzlenecek', devam: 'İzleniyor', bitti: 'İzlendi' },
    colorVar: 'dizi',
  },
  muzik: {
    label: 'Müzik', emoji: '🎵', creatorLabel: 'Sanatçı', emojis: ['🎵'],
    statusLabels: {},
    colorVar: 'muzik',
  },
}

//export const AVATAR_CHOICES = ['📖', '🎬', '📺', '⚔️', '🐺', '🌙', '⭐', '🔥', '🌸', '🍀']
export const AVATAR_CHOICES = [
  '📖', '🎬', '📺', '⚔️', '🐺', '🌙', '⭐', '🔥', '🌸', '🍀',
  '🦋', '🪐', '☁️', '🌊', '🍄', '🌿', '🌻', '🌷', '🌹', '🪻',
  '🦊', '🐈‍⬛', '🐇', '🦢', '🦉', '🐉', '🦄', '🐚', '🪼', '🐝',
  '🎧', '🎮', '🎨', '📷', '🎀', '🧸', '🪩', '💿', '🕯️', '🔮',
  '🍓', '🍒', '🍰', '☕', '🥐', '🍪', '🍑', '🍋', '🫐', '🍬',
  '✨', '💫', '🌌', '🌈', '☀️', '❄️', '⚡', '💎', '🫧', '🪄',
  '👑', '🗡️', '🛡️', '🏹', '🧿', '🪬', '🧩', '🎲', '🎵', '💌'
]
