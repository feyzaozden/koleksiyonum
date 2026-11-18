export async function request(path, signal) {
  const response = await fetch(path, { credentials: 'same-origin', signal })
  if (response.status === 401) {
    const error = new Error('Oturumun sona erdi. Lütfen tekrar giriş yap.')
    error.status = 401
    throw error
  }
  if (!response.ok) throw new Error('Koleksiyon yüklenemedi. Tekrar deneyebilirsin.')
  return response.json()
}

// Fetch every page before filtering, so search and totals cover the entire collection.
export async function loadCollection(signal) {
  const result = []
  for (let offset = 0; ; offset += 50) {
    const page = await request(`/api/collection?limit=50&offset=${offset}`, signal)
    result.push(...page.items)
    if (result.length >= page.total || page.items.length === 0) return [...new Map(result.map(item => [item.id, item])).values()]
  }
}
