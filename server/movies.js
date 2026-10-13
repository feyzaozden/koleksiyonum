// Shared by Vercel and the local Vite server. Never import this file in src/.
export function createMovieHandler(options) { return createMediaHandler('movie', options) }
export function createSeriesHandler(options) { return createMediaHandler('tv', options) }

function createMediaHandler(type, { env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const isSeries = type === 'tv'
  const label = isSeries ? 'Dizi' : 'Film'
  const cache = new Map()
  return async function movies(req, res) {
    function reply(status, body) {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'private, no-store')
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return reply(405, { error: 'Bu işlem desteklenmiyor.' })
    }
    const params = new URL(req.url, 'http://localhost').searchParams
    const query = (params.get('q') || '').trim()
    const id = params.get('id')
    if (id !== null ? !/^[1-9]\d{0,9}$/.test(id) : query.length < 2 || query.length > 100) {
      return reply(400, { error: 'Arama için 2–100 karakter gir.' })
    }
    const authorization = req.headers.authorization
    if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
      return reply(401, { error: `${label} aramak için giriş yapmalısın.` })
    }
    const token = env.TMDB_READ_ACCESS_TOKEN
    const supabaseUrl = env.VITE_SUPABASE_URL
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY
    if (!token || !supabaseUrl || !supabaseKey) {
      return reply(503, { error: `${label} araması henüz kullanıma hazır değil. Bilgileri elle ekleyebilirsin.` })
    }
    try {
      const auth = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: supabaseKey, Authorization: authorization },
        signal: AbortSignal.timeout(8000),
      })
      if (auth.status === 401 || auth.status === 403) {
        return reply(401, { error: 'Oturumun sona ermiş. Tekrar giriş yap.' })
      }
      if (!auth.ok) return reply(503, { error: 'Oturum doğrulanamadı. Biraz sonra tekrar dene.' })
      if (!(await auth.json()).id) return reply(401, { error: 'Tekrar giriş yapmalısın.' })

      const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Istanbul' }).format(now()))
      const key = `${currentYear}:${id ? `id:${id}` : `q:${query.toLocaleLowerCase('tr-TR')}`}`
      const cached = cache.get(key)
      if (cached && cached.until > now().getTime()) return reply(200, cached.body)
      const url = new URL(`https://api.themoviedb.org/3/${id ? `${type}/${id}` : `search/${type}`}`)
      url.searchParams.set('language', 'tr-TR')
      if (id && !isSeries) url.searchParams.set('append_to_response', 'credits')
      if (!id) {
        url.searchParams.set('query', query)
        url.searchParams.set('include_adult', 'false')
        url.searchParams.set('page', '1')
      }
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (response.status === 429) return reply(429, { error: `${label} araması şu an yoğun. Biraz sonra tekrar dene.` })
      if (response.status === 404) return reply(404, { error: `${label} bulunamadı. Başka bir sonuç seçebilirsin.` })
      if (!response.ok) return reply(502, { error: `${label} bilgilerine şu anda ulaşılamıyor. Elle ekleyebilir veya tekrar deneyebilirsin.` })
      const data = await response.json()
      const releaseDate = (item) => isSeries ? item.first_air_date : item.release_date
      const allowed = (movie) => !movie.adult && (!releaseDate(movie) || Number(releaseDate(movie).slice(0, 4)) <= currentYear)
      const summary = (movie) => ({
        id: movie.id,
        title: (isSeries ? movie.name || movie.original_name : movie.title || movie.original_title) || '',
        originalTitle: (isSeries ? movie.original_name : movie.original_title) || '',
        year: releaseDate(movie)?.slice(0, 4) || '',
        poster: /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(movie.poster_path || '')
          ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` : null,
      })
      if (id && !allowed(data)) return reply(400, { error: 'Bu içerik eklenemiyor. Gelecek yıllara ait içerikleri şu an ekleyemezsin.' })
      const creators = isSeries ? (data.created_by || []) : (data.credits?.crew || []).filter((person) => person.job === 'Director')
      const body = id ? { [isSeries ? 'series' : 'movie']: {
        ...summary(data),
        creator: [...new Set(creators.map((person) => person.name).filter(Boolean))].join(', '),
      } } : { results: (data.results || []).filter(allowed).map(summary) }
      if (cache.size >= 150) cache.delete(cache.keys().next().value)
      cache.set(key, { body, until: now().getTime() + 5 * 60 * 1000 })
      return reply(200, body)
    } catch {
      return reply(503, { error: `${label} aramasına bağlanılamadı. Biraz sonra tekrar dene veya bilgileri elle ekle.` })
    }
  }
}
