export function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}
