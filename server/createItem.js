import { createMovieHandler, createSeriesHandler } from './movies.js'

async function readBody(req) {
  if (req.body !== undefined) {
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(text) > 16000) throw new Error('body')
    return JSON.parse(text)
  }
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (Buffer.byteLength(text) > 16000) throw new Error('body')
  }
  return JSON.parse(text)
}

export function createVerifiedItemHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const serverKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  const catalog = { film: createMovieHandler({ env, fetchImpl }), dizi: createSeriesHandler({ env, fetchImpl }) }
  return async (req, res) => {
    const reply = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'private, no-store')
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { error: 'Bu işlem desteklenmiyor.' }) }
    const authorization = req.headers.authorization
    if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) return reply(401, { error: 'Lütfen tekrar giriş yap.' })
    let input
    try { input = await readBody(req) } catch { return reply(400, { error: 'Geçersiz veya çok büyük kayıt.' }) }
    if (!input || !['film','dizi'].includes(input.category) || !Number.isSafeInteger(input.source_id) || input.source_id < 1 || input.source_id > 9999999999) {
      return reply(400, { error: 'Aramadan geçerli bir film veya dizi seç.' })
    }
    if (!serverKey || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !env.TMDB_READ_ACCESS_TOKEN) {
      return reply(503, { error: 'Kaynak doğrulaması henüz hazır değil. Site yöneticisinin sunucu ayarını tamamlaması gerekiyor.' })
    }
    try {
      const base = env.VITE_SUPABASE_URL.replace(/\/$/, '')
      const authResponse = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: authorization }, signal: AbortSignal.timeout(8000) })
      if (!authResponse.ok) return reply(authResponse.status >= 500 ? 503 : 401, { error: 'Oturum doğrulanamadı. Tekrar giriş yap.' })
      const user = await authResponse.json()
      if (!user.id) return reply(401, { error: 'Oturum doğrulanamadı.' })
      let result
      const response = { statusCode: 200, setHeader() {}, end(value) { result = JSON.parse(value) } }
      await catalog[input.category]({ method: 'GET', url: `/api/catalog?id=${input.source_id}`, headers: { authorization } }, response)
      if (response.statusCode !== 200) return reply(response.statusCode, result)
      const item = input.category === 'film' ? result.movie : result.series
      if (!item || item.id !== input.source_id || !item.title) return reply(502, { error: 'Kaynak bilgisi doğrulanamadı.' })
      // Never accept user_id, source, title, creator, year or added_at from the caller.
      const payload = {
        user_id: user.id, category: input.category, source: 'tmdb', source_id: item.id,
        title: item.title, creator: item.creator || null, year: item.year || null,
        status: input.status ?? 'bekliyor', note: input.note ?? null,
        start_date: input.start_date ?? null, end_date: input.end_date ?? null,
        rating: input.rating ?? null, emoji: input.category === 'film' ? '🎬' : '📺',
      }
      const saved = await fetchImpl(`${base}/rest/v1/items?select=*`, {
        method: 'POST', headers: { apikey: serverKey, ...(!serverKey.startsWith('sb_secret_') ? { Authorization: `Bearer ${serverKey}` } : {}),
          'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
      })
      const data = await saved.json()
      if (!saved.ok) {
        const message = data.code === '23505' ? 'Bu içerik zaten koleksiyonunda. Mevcut kaydı düzenleyebilirsin.'
          : data.code === 'P0001' ? data.message : 'Kayıt eklenemedi. Alanları ve veritabanı kurulumunu kontrol et.'
        return reply(data.code === '23505' ? 409 : 400, { error: message })
      }
      return reply(201, { item: data[0] })
    } catch { return reply(503, { error: 'Kayıt sonucu doğrulanamadı. Tekrar denemeden önce koleksiyonunu yenile.' }) }
  }
}
