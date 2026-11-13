// Server only: MusicBrainz metadata and official YouTube playback selection.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VIDEO = /^[A-Za-z0-9_-]{11}$/
export function musicSummary(recording, release) {
  return {
    id: recording.id, title: recording.title,
    creator: (recording['artist-credit'] || []).map(a => (a.name || a.artist?.name || '') + (a.joinphrase || '')).join(''),
    album: release?.title || '', release_id: release?.id || null,
    year: (release?.date || recording['first-release-date'] || '').slice(0, 4),
    duration_ms: recording.length || null,
  }
}

export function createMusicHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const cache = new Map()
  let queue = Promise.resolve(), lastRequest = 0
  async function catalog(path) {
    const hit = cache.get(path)
    if (hit && hit.until > Date.now()) return hit.value
    const work = queue.then(async () => {
      const delay = 1100 - (Date.now() - lastRequest)
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
      lastRequest = Date.now()
      const response = await fetchImpl('https://musicbrainz.org/ws/2/' + path, {
        headers: { 'User-Agent': 'Koleksiyonum/1.0 (https://koleksiyonum.com.tr)', Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error('Müzik kataloğuna şu anda ulaşılamıyor. Biraz sonra tekrar dene.')
      const value = await response.json()
      if (cache.size >= 100) cache.delete(cache.keys().next().value)
      cache.set(path, { value, until: Date.now() + 300000 })
      return value
    })
    queue = work.catch(() => {})
    return work
  }
  return async (req, res) => {
    function reply(status, body) {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'private, no-store')
      res.end(JSON.stringify(body))
    }
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) return reply(405, { error: 'Desteklenmeyen işlem.' })
    const authorization = req.headers.authorization
    if (!/^Bearer \S+$/.test(authorization || '')) return reply(401, { error: 'Lütfen giriş yap.' })
    const base = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
    const anon = env.VITE_SUPABASE_ANON_KEY
    if (!base || !anon) return reply(503, { error: 'Müzik servisi henüz hazır değil.' })
    try {
      const auth = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(8000) })
      if (!auth.ok) return reply(auth.status >= 500 ? 503 : 401, { error: 'Oturum doğrulanamadı.' })
      const user = await auth.json()
      if (!user.id) return reply(401, { error: 'Lütfen tekrar giriş yap.' })
      const params = new URL(req.url, 'http://localhost').searchParams
      const youtube = async (path, args) => {
        if (!env.YOUTUBE_API_KEY) throw new Error('YouTube araması için sunucuda YOUTUBE_API_KEY ayarı tamamlanmalı.')
        const url = new URL('https://www.googleapis.com/youtube/v3/' + path)
        for (const [key, value] of Object.entries({ ...args, key: env.YOUTUBE_API_KEY })) url.searchParams.set(key, value)
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw new Error('YouTube araması tamamlanamadı. API ayarını veya arama kotasını kontrol et.')
        return response.json()
      }
      if (req.method === 'GET') {
        const query = (params.get('q') || '').trim()
        if (query.length < 2 || query.length > 100) return reply(400, { error: 'Arama için 2–100 karakter gir.' })
        if (params.get('videos') === '1') {
          const key = 'yt:' + query
          let data = cache.get(key)
          if (!data || data.until < Date.now()) {
            const result = await youtube('search', { part: 'snippet', q: query, type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: '5', safeSearch: 'moderate' })
            data = { until: Date.now() + 300000, value: { results: (result.items || []).filter(v => VIDEO.test(v.id?.videoId)).map(v => ({ id: v.id.videoId, title: v.snippet.title, channel: v.snippet.channelTitle })) } }
            if (cache.size >= 100) cache.delete(cache.keys().next().value)
            cache.set(key, data)
          }
          return reply(200, data.value)
        }
        // Escape Lucene operators; do not interpolate raw user syntax.
        const escaped = query.replace(/[+\-!(){}[\]^"~*?:\\/|&]/g, ' ').trim()
        const data = await catalog('recording?' + new URLSearchParams({ query: escaped, fmt: 'json', limit: '15' }))
        return reply(200, { results: (data.recordings || []).flatMap(r => {
          const releases = (r.releases || []).slice(0, 3)
          return (releases.length ? releases : [null]).map(release => musicSummary(r, release))
        }) })
      }
      let raw = typeof req.body === 'string' ? req.body : req.body !== undefined ? JSON.stringify(req.body) : ''
      if (req.body === undefined) for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16000) break }
      if (Buffer.byteLength(raw) > 16000) return reply(400, { error: 'Kayıt çok büyük.' })
      let input
      try { input = JSON.parse(raw) } catch { return reply(400, { error: 'Geçersiz kayıt.' }) }
      if (!input || typeof input !== 'object') return reply(400, { error: 'Geçersiz kayıt.' })
      const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
      if (!key) return reply(503, { error: 'Sunucu kayıt ayarı eksik.' })
      const headers = { apikey: key, ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', Prefer: 'return=representation' }
      let saved
      if (req.method === 'PATCH') {
        if (!/^[1-9]\d{0,18}$/.test(String(input.item_id)) || !VIDEO.test(input.video_id || '')) return reply(400, { error: 'Geçersiz video seçimi.' })
        const data = await youtube('videos', { part: 'status', id: input.video_id })
        if (!data.items?.[0]?.status?.embeddable) return reply(400, { error: 'Bu video site içinde oynatılamıyor.' })
        saved = await fetchImpl(`${base}/rest/v1/items?id=eq.${input.item_id}&user_id=eq.${user.id}&category=eq.muzik&select=*`, { method: 'PATCH', headers, body: JSON.stringify({ youtube_id: input.video_id }), signal: AbortSignal.timeout(10000) })
      } else {
        if (!UUID.test(input.music_recording_id || '') || (input.music_release_id != null && !UUID.test(input.music_release_id))) return reply(400, { error: 'Aramadan bir şarkı seç.' })
        const recording = await catalog(`recording/${input.music_recording_id}?inc=artist-credits+releases&fmt=json`)
        const release = input.music_release_id ? recording.releases?.find(r => r.id === input.music_release_id) : null
        if (input.music_release_id && !release) return reply(400, { error: 'Bu albüm şarkıyla eşleşmiyor. Başka bir sonuç seç.' })
        const music = musicSummary(recording, release)
        const payload = {
          user_id: user.id, category: 'muzik', title: music.title, creator: music.creator || null, year: music.year || null,
          music_recording_id: music.id, music_release_id: music.release_id, album: music.album || null, duration_ms: music.duration_ms,
          emoji: '🎵', status: input.status ?? 'bekliyor', note: input.note ?? null, rating: input.rating ?? null,
        }
        saved = await fetchImpl(`${base}/rest/v1/items?select=*`, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) })
      }
      const result = await saved.json()
      if (!saved.ok) return reply(400, { error: result.code === '23505' ? 'Bu şarkı zaten Şarkılarım listende.' : result.code === 'P0001' ? result.message : 'Kaydedilemedi. Müzik SQL kurulumunu kontrol et.' })
      if (!result[0]) return reply(404, { error: 'Şarkı bulunamadı veya sana ait değil.' })
      return reply(req.method === 'POST' ? 201 : 200, { item: result[0] })
    } catch (error) {
      return reply(503, { error: /^(Müzik kataloğuna|YouTube araması)/.test(error.message) ? error.message : 'Müzik servisine ulaşılamadı. Tekrar denemeden önce koleksiyonunu kontrol et.' })
    }
  }
}
