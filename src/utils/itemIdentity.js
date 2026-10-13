export function normalizeItemTitle(value) {
  return (value || '').normalize('NFKC').replace(/İ/g, 'i').toLowerCase().replace(/ı/g, 'i').trim().replace(/\s+/g, ' ')
}

export function itemWriteMessage(error) {
  if (error?.code === '23505') return 'Bu içerik zaten koleksiyonunda. Mevcut kaydı düzenleyebilirsin.'
  return error?.message || 'Kayıt kaydedilemedi.'
}
