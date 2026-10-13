export function parseBulkItems(text, category) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) throw new Error('En az bir içerik yaz.')
  if (lines.length > 100) throw new Error('Tek seferde en fazla 100 satır ekleyebilirsin.')
  return lines.map((line, index) => {
    const parts = line.split('|').map((part) => part.trim())
    if (parts.length > 3) throw new Error(`${index + 1}. satırda en fazla başlık | yazar/yönetmen | yıl kullan.`)
    return { category, title: parts[0], creator: parts[1] || null, year: parts[2] || null,
      status: 'bekliyor', emoji: category === 'kitap' ? '📖' : category === 'film' ? '🎬' : '📺' }
  })
}
