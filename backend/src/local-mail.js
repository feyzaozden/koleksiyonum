import { createHash, randomBytes } from 'node:crypto'

// Deliberately local-only. Never connect this inbox to a public deployment.
export function createLocalMail(pool, origin) {
  const messages = []
  return {
    list: () => messages.filter(message => message.expires > Date.now()).map(({ email, purpose, link }) => ({ email, purpose, link })),
    async send(email, purpose) {
      const token = randomBytes(32).toString('hex')
      const hash = createHash('sha256').update(token).digest('hex')
      const result = await pool.query('SELECT accounts.create_action_token($1,$2,$3) AS created',[email,purpose,hash])
      if (!result.rows[0]?.created) return
      messages.unshift({ email, purpose, link: `${origin}/auth-lab#${purpose}=${token}`, expires: Date.now() + (purpose === 'verify' ? 86400000 : 1800000) })
      messages.splice(30)
    },
  }
}
