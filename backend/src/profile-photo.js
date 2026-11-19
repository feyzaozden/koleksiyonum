import { createHash } from 'node:crypto'
import sharp from 'sharp'

const fail = (status, message) => Object.assign(new Error(message), { status })
let active = 0
export async function normalizePhoto(buffer) {
  if (active >= 2) throw fail(429, 'Fotoğraf işlemleri yoğun. Biraz sonra tekrar dene.')
  active++
  try {
    const image = sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning' })
    const meta = await image.metadata()
    if (!['jpeg','png','webp'].includes(meta.format) || (meta.pages || 1) !== 1) throw new Error('format')
    // Re-encoding strips EXIF/location metadata and ignores the original filename.
    const output = await image.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer()
    if (output.length > 524288) throw new Error('size')
    return output
  } catch { throw fail(400, 'Geçerli, tek kareli bir JPEG, PNG veya WebP fotoğrafı seç (en fazla 16 megapiksel).') }
  finally { active-- }
}

export function createProfilePhoto(pool, { origin }) {
  const cookieName = new URL(origin).protocol === 'https:' ? '__Host-koleksiyonum_session' : 'koleksiyonum_dev_session'
  return async (req, res) => {
    const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(body)) }
    try {
      if (!['GET','PUT','DELETE'].includes(req.method)) { res.setHeader('Allow','GET, PUT, DELETE'); throw fail(405,'Bu yöntem desteklenmiyor.') }
      if (req.method !== 'GET' && (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site')) throw fail(403,'İstek kaynağına izin verilmiyor.')
      const cookies = (req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(cookieName + '='))
      const token = cookies.length === 1 ? cookies[0].slice(cookieName.length + 1) : ''
      if (!/^[a-f0-9]{64}$/.test(token)) throw fail(401,'Lütfen giriş yap.')
      const hash = createHash('sha256').update(token).digest('hex')
      if (req.method === 'GET') {
        const result = await pool.query('SELECT collection.get_own_photo($1) AS image',[hash])
        const image = result.rows[0].image
        if (!image) throw fail(404,'Profil fotoğrafı yok.')
        res.setHeader('Content-Type','image/webp'); res.end(Buffer.from(image)); return
      }
      const revision = Number(req.headers['x-profile-revision'])
      if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647) throw fail(400,'Güncel profil sürümü gerekli.')
      // Authenticate before reading/decoding an upload.
      await pool.query('SELECT collection.require_actor($1)',[hash])
      let image = null
      if (req.method === 'PUT') {
        if (Number(req.headers['content-length']) > 5 * 1024 * 1024) throw fail(413,'Fotoğraf en fazla 5 MB olabilir.')
        if (!['image/jpeg','image/png','image/webp'].includes(req.headers['content-type'])) throw fail(415,'JPEG, PNG veya WebP seç.')
        const chunks = []; let size = 0
        for await (const chunk of req) { size += chunk.length; if (size > 5 * 1024 * 1024) throw fail(413,'Fotoğraf en fazla 5 MB olabilir.'); chunks.push(chunk) }
        image = await normalizePhoto(Buffer.concat(chunks))
      }
      const result = await pool.query('SELECT collection.set_own_photo($1,$2,$3) AS profile',[hash, revision, image])
      json(200, { profile: result.rows[0].profile })
    } catch (error) {
      const status = error.status || ({ P0401:401, P0404:404, P0409:409 })[error.code] || 503
      json(status, { error: status === 503 ? 'Fotoğraf kaydedilemedi. Tekrar dene.' : error.message })
    }
  }
}
