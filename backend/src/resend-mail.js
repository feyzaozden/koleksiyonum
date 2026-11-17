import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

export function createResendMail(pool, { origin, apiKey, from, recipients, fetchImpl = fetch, sleep = delay }) {
  const url = new URL(origin)
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Mail requires an exact HTTPS origin')
  if (!apiKey || !/^re_[\w-]+$/.test(apiKey)) throw new Error('Invalid RESEND_API_KEY configuration')
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from || '')) throw new Error('MAIL_FROM must be an email address')
  const allowed = new Set((recipients || '').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean))
  if (!allowed.size || [...allowed].some(email=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Explicit MAIL_TEST_RECIPIENTS required')
  return {
    allows: email => allowed.has(email),
    async send(email, purpose) {
      if (!allowed.has(email)) return
      if (!['verify','reset'].includes(purpose)) throw new Error('Invalid mail purpose')
      const token = randomBytes(32).toString('hex')
      const hash = createHash('sha256').update(token).digest('hex')
      const result = await pool.query('SELECT accounts.create_action_token($1,$2,$3) AS created',[email,purpose,hash])
      if (!result.rows[0]?.created) return
      const link = `${origin}/auth-test#${purpose}=${token}`
      const verify = purpose === 'verify'
      const subject = verify ? 'Koleksiyonum — e-posta adresini doğrula' : 'Koleksiyonum — şifreni sıfırla'
      const text = `${subject}\n\nBu mesaj Koleksiyonum test ortamından gönderildi. Canlı hesabını değiştirmez.\n\n${link}\n\nBağlantı ${verify ? '24 saat' : '30 dakika'} geçerlidir ve yalnızca bir kez kullanılabilir.\nBu işlemi sen başlatmadıysan bağlantıyı kullanma.`
      const body = JSON.stringify({ from:`Koleksiyonum <${from}>`, to:[email], subject, text })
      const idempotencyKey = `auth/${randomUUID()}`
      for (let attempt=0; attempt<3; attempt++) {
        let retry = true
        try {
          const response = await fetchImpl('https://api.resend.com/emails', {
            method:'POST', redirect:'error', signal:AbortSignal.timeout(5000),
            headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json', 'Idempotency-Key':idempotencyKey }, body,
          })
          // Provider bodies may contain sensitive data. Never log or return them.
          if (response.ok) { await response.body?.cancel(); return }
          retry = response.status === 429 || response.status >= 500
          await response.body?.cancel()
        } catch { /* Retry transient network/timeout failures with the SAME token and idempotency key. */ }
        if (!retry || attempt === 2) break
        await sleep(500 * (attempt+1))
      }
      throw Object.assign(new Error('E-posta gönderimi tamamlanamadı. Biraz sonra yeniden bağlantı iste.'),{status:503})
    },
  }
}
