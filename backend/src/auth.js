import { createHash, randomBytes } from 'node:crypto'
import { hashPassword, verifyPassword } from './password.js'
import { createLocalMail } from './local-mail.js'

const digest = value => createHash('sha256').update(value).digest('hex')
const fail = (status, message) => Object.assign(new Error(message), { status })
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
const emailValid = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
async function bodyOf(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw fail(415, 'JSON gerekli.')
  let size = 0; const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8192) throw fail(413, 'İstek çok büyük.')
    chunks.push(chunk)
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error()
    return data
  } catch { throw fail(400, 'Geçersiz istek.') }
}

export function createAuth(pool, { origin, allowLocalRegistration = false, requireEmailVerification = true } = {}) {
  const url = new URL(origin)
  if (url.origin !== origin) throw new Error('AUTH_ORIGIN must be an exact origin')
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('HTTPS required')
  if (allowLocalRegistration && !local) throw new Error('Unverified registration is local-only')
  const mail = allowLocalRegistration ? createLocalMail(pool, origin) : null
  const secure = url.protocol === 'https:'
  const cookieName = secure ? '__Host-koleksiyonum_session' : 'koleksiyonum_dev_session'
  const cookie = (token, clear = false) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${secure ? '; Secure' : ''}`
  function tokenOf(req) {
    const entries = (req.headers.cookie || '').split(';').map(p => p.trim()).filter(p => p.startsWith(cookieName + '='))
    if (entries.length !== 1) return ''
    const token = entries[0].slice(cookieName.length + 1)
    return /^[a-f0-9]{64}$/.test(token) ? token : ''
  }
  async function limit(key, max) {
    const { rows } = await pool.query('SELECT accounts.consume_auth_limit($1,$2) AS allowed', [digest(key),max])
    if (!rows[0]?.allowed) throw fail(429, 'Çok fazla deneme yaptın. 15 dakika sonra tekrar dene.')
  }
  return async (req, res, path) => {
    const reply = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)) }
    const token = tokenOf(req)
    try {
      if (!['/auth/register','/auth/login','/auth/session','/auth/logout','/auth/local-inbox','/auth/request-verification','/auth/forgot-password','/auth/verify-email','/auth/reset-password'].includes(path)) return reply(404,{ error:'not_found' })
      const method = ['/auth/session','/auth/local-inbox'].includes(path) ? 'GET' : 'POST'
      if (req.method !== method) { res.setHeader('Allow', method); return reply(405,{ error:'method_not_allowed' }) }
      // No CORS. Same-origin JSON requests only, including login (login CSRF).
      if (method === 'POST' && (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site')) throw fail(403,'İstek kaynağına izin verilmiyor.')
      if (path === '/auth/local-inbox') {
        if (!mail) return reply(404,{ error:'not_found' })
        // Require a custom header and matching Host, preventing cross-origin reads/DNS rebinding.
        if (req.headers['x-local-lab'] !== '1' || req.headers.host !== url.host || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') throw fail(403,'Yerel test ekranından aç.')
        return reply(200,{ messages:mail.list() })
      }
      if (method === 'GET') {
        if (!token) return reply(401,{ error:'Oturum bulunamadı.' })
        const { rows } = await pool.query('SELECT * FROM accounts.session_user($1)',[digest(token)])
        if (!rows.length) { res.setHeader('Set-Cookie',cookie('',true)); return reply(401,{ error:'Oturum sona erdi.' }) }
        return reply(200,{ user:rows[0] })
      }
      if (path === '/auth/logout') {
        if (token) await pool.query('SELECT accounts.revoke_session($1)',[digest(token)])
        res.setHeader('Set-Cookie',cookie('',true)); return reply(200,{ ok:true })
      }
      // Proxy headers are intentionally ignored until the trusted reverse proxy is configured.
      await limit('ip:' + req.socket.remoteAddress,50)
      const body = await bodyOf(req)
      if (['/auth/verify-email','/auth/reset-password'].includes(path)) {
        if (!mail) throw fail(503,'Bu işlem henüz kullanıma açık değil.')
        if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw fail(400,'Bağlantı geçersiz veya süresi dolmuş.')
        const reset = path === '/auth/reset-password'
        let newHash = null
        if (reset) {
          if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128 || !/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/[0-9]/.test(body.password)) throw fail(400,'Şifre 8–128 karakter, büyük harf, küçük harf ve rakam içermeli.')
          if (body.password !== body.password_confirmation) throw fail(400,'Şifreler aynı olmalı.')
          newHash = await hashPassword(body.password)
        }
        const result = await pool.query('SELECT accounts.consume_action_token($1,$2,$3) AS consumed',[digest(body.token),reset ? 'reset' : 'verify',newHash])
        if (!result.rows[0]?.consumed) throw fail(400,'Bağlantı geçersiz, kullanılmış veya süresi dolmuş.')
        if (reset) res.setHeader('Set-Cookie',cookie('',true))
        return reply(200,{ ok:true })
      }
      const email = emailOf(body.email)
      if (['/auth/request-verification','/auth/forgot-password'].includes(path)) {
        if (!mail) throw fail(503,'E-posta gönderimi henüz yapılandırılmadı.')
        if (!emailValid(email)) throw fail(400,'Geçerli bir e-posta adresi gir.')
        await limit('mail:' + email,5)
        await mail.send(email,path === '/auth/forgot-password' ? 'reset' : 'verify')
        return reply(200,{ ok:true, message:'Hesabın bu işlem için uygunsa bağlantı gönderildi.' })
      }
      if (!emailValid(email) || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) throw fail(400,'Geçerli e-posta ve en fazla 128 karakterlik şifre gir.')
      await limit('email:' + email,10)
      let user, hash
      if (path === '/auth/register') {
        if (!allowLocalRegistration) throw fail(503,'Kayıt henüz kullanıma açık değil.')
        const username = typeof body.username === 'string' ? body.username.replace(/[A-Z]/g,c => c.toLowerCase()) : ''
        const name = typeof body.display_name === 'string' ? body.display_name.trim() : ''
        if (!/^[a-z][a-z0-9_.]{2,29}$/.test(username)) throw fail(400,'Kullanıcı adı 3–30 karakter olmalı; küçük harfle başlamalı, yalnızca harf, rakam, _ ve . içermeli.')
        if (!name || name.length > 100) throw fail(400,'Ad soyad 1–100 karakter olmalı.')
        if (body.password.length < 8 || !/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/[0-9]/.test(body.password)) throw fail(400,'Şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermeli.')
        if (body.password !== body.password_confirmation) throw fail(400,'Şifreler aynı olmalı.')
        hash = await hashPassword(body.password)
        try {
          const { rows } = await pool.query('SELECT accounts.register_user($1,$2,$3,$4) AS id',[email,hash,username,name])
          user = rows[0]
        } catch (error) {
          if (error.code === '23505') throw fail(409,'Bu bilgilerle kayıt oluşturulamadı. Bilgilerini kontrol et veya giriş yap.')
          throw error
        }
      } else {
        const { rows } = await pool.query('SELECT * FROM accounts.login_candidate($1)',[email])
        user = rows[0]; hash = user?.password_hash
        if (!await verifyPassword(body.password,hash)) throw fail(401,'E-posta veya şifre yanlış.')
      }
      if (path === '/auth/register' && requireEmailVerification) {
        await mail.send(email,'verify')
        return reply(201,{ ok:true, verification_required:true })
      }
      const next = randomBytes(32).toString('hex')
      const result = await pool.query('SELECT accounts.issue_session($1,$2,$3,$4,$5) AS issued',[user.id,hash,digest(next),token ? digest(token) : null,allowLocalRegistration && !requireEmailVerification])
      if (!result.rows[0]?.issued) throw fail(401,'E-posta veya şifre yanlış ya da hesap girişe uygun değil.')
      res.setHeader('Set-Cookie',cookie(next))
      return reply(path === '/auth/register' ? 201 : 200,{ ok:true })
    } catch (error) {
      if (error.status === 429) res.setHeader('Retry-After','900')
      return reply(error.status || 503,{ error:error.status ? error.message : 'İşlem tamamlanamadı. Biraz sonra tekrar dene.' })
    }
  }
}
