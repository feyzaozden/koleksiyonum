export function progressError(p, category) {
  for (const key of ['position', 'total', 'season', 'seasons']) {
    if (p[key] != null && (!Number.isInteger(p[key]) || p[key] < (key === 'position' && category !== 'dizi' ? 0 : 1) || p[key] > 1000000)) return 'Geçerli, pozitif tam sayılar gir (en fazla 1000000).'
  }
  for (const [season, total] of Object.entries(p.episodes || {})) {
    if (!/^[1-9]\d*$/.test(season) || Number(season) > 1000000 || !Number.isInteger(total) || total < 1 || total > 1000000) return 'Sezon bölüm sayısı geçerli olmalı.'
    if (p.seasons && Number(season) > p.seasons) return 'Toplam sezon, kayıtlı sezonlardan küçük olamaz.'
  }
  if (category === 'dizi') {
    if ((p.season == null) !== (p.position == null)) return 'Sezon ve bölümü birlikte gir.'
    if (p.seasons && p.season > p.seasons) return 'Bulunduğun sezon toplam sezonu aşamaz.'
    if (p.episodes?.[p.season] && p.position > p.episodes[p.season]) return 'Bulunduğun bölüm sezonun bölüm sayısını aşamaz.'
  } else if (p.total != null && p.position > p.total) return 'İlerleme toplam değeri aşamaz.'
  return ''
}

export function progressText(item) {
  const p = item.progress || {}
  if (p.position == null) return 'İlerleme henüz girilmedi'
  if (item.category === 'dizi') return `Sezon ${p.season}${p.seasons ? '/' + p.seasons : ''} · Bölüm ${p.position}${p.episodes?.[p.season] ? '/' + p.episodes[p.season] : ''}${item.status === 'bitti' ? ' · Tamamlandı' : ' · Bu bölümdeyim'}`
  const unit = item.category === 'kitap' ? 'sayfa' : 'dakika'
  return `${p.position}${p.total ? ' / ' + p.total : ''} ${unit}`
}

export function progressPatch(item, progress) {
  const error = progressError(progress, item.category)
  if (error) throw new Error(error)
  return { progress, ...(item.status === 'bekliyor' && progress.position != null ? { status: 'devam' } : {}) }
}
