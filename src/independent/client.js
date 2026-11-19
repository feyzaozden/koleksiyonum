export async function request(path, signal, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', signal })
  if (response.status === 401) {
    const error = new Error('Oturumun sona erdi. Lütfen tekrar giriş yap.')
    error.status = 401
    throw error
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = new Error(body.error || 'İşlem tamamlanamadı. Tekrar deneyebilirsin.')
    error.status = response.status
    throw error
  }
  return response.json()
}

export async function saveItem(data, item = null) {
  const result = await request(item ? `/api/collection/${encodeURIComponent(item.id)}` : '/api/collection', undefined, {
    method: item ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item ? { ...data, revision: item.revision } : data),
  })
  return result.item
}

export async function saveCatalogItem(data, selected) {
  const { status, note, start_date, end_date, rating, progress } = data
  const result = await request('/api/collection/catalog', undefined, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: selected.category, source_id: selected.id, status, note, start_date, end_date, rating, progress }),
  })
  return result.item
}

export async function removeItem(item) {
  return request(`/api/collection/${encodeURIComponent(item.id)}`, undefined, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: item.revision }),
  })
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
