// Credentials and provider requests stay on the server; no Supabase dependency.
export function createCatalog({ token = process.env.TMDB_READ_ACCESS_TOKEN, fetchImpl = fetch, now = () => new Date() } = {}) {
  const cache = new Map()
  const fail = (status, message) => Object.assign(new Error(message), { status })
  return async (category, { q, id }) => {
    if (!['film', 'dizi'].includes(category) || (id != null ? !/^[1-9]\d{0,9}$/.test(String(id)) : typeof q !== 'string' || q.trim().length < 2 || q.trim().length > 100)) throw fail(400, 'Geçerli bir arama yap.')
    if (!token) throw fail(503, 'Film/dizi araması henüz hazır değil. Bilgileri elle ekleyebilirsin.')
    const today = now().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
    const key = `${today}:${category}:${id != null ? `id:${id}` : `q:${q.trim()}`}`
    const hit = cache.get(key)
    if (hit?.until > now().getTime()) return hit.value
    const type = category === 'dizi' ? 'tv' : 'movie'
    const url = new URL(`https://api.themoviedb.org/3/${id ? `${type}/${id}` : `search/${type}`}`)
    url.searchParams.set('language', 'tr-TR')
    if (id && type === 'movie') url.searchParams.set('append_to_response', 'credits')
    if (!id) { url.searchParams.set('query', q.trim()); url.searchParams.set('include_adult', 'false'); url.searchParams.set('page', '1') }
    let response, data
    try {
      response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
      if (response.ok) data = await response.json()
    } catch { throw fail(503, 'Katalog bağlantısı kurulamadı. Biraz sonra tekrar dene.') }
    if (!response.ok) throw fail(response.status === 429 ? 429 : response.status === 404 ? 404 : 502, 'Katalog bilgisi alınamadı. Biraz sonra tekrar dene.')
    const date = item => type === 'tv' ? item.first_air_date : item.release_date
    const allowed = item => item && !item.adult && (!date(item) || date(item) <= today)
    const summary = item => ({ id: item.id, category,
      title: (type === 'tv' ? item.name || item.original_name : item.title || item.original_title) || '',
      year: date(item)?.slice(0, 4) || '',
      poster_path: /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(item.poster_path || '') ? item.poster_path : null,
    })
    let value
    if (id) {
      if (!allowed(data) || String(data.id) !== String(id)) throw fail(400, 'Bu içerik henüz yayımlanmamış veya eklenemiyor.')
      const creators = type === 'tv' ? data.created_by || [] : (data.credits?.crew || []).filter(person => person.job === 'Director')
      value = { ...summary(data), creator: [...new Set(creators.map(person => person.name).filter(Boolean))].join(', ') || null }
    } else value = { results: (data.results || []).filter(allowed).map(summary) }
    if (cache.size >= 150) cache.delete(cache.keys().next().value)
    cache.set(key, { value, until: now().getTime() + 300000 })
    return value
  }
}
