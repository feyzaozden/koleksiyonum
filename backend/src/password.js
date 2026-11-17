import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const derive = promisify(scrypt)
const options = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 }
let active = 0
// Bound memory usage: never queue an unbounded number of expensive hashes.
async function key(password, salt) {
  if (active >= 2) { const error = new Error('Sunucu meşgul. Biraz sonra tekrar dene.'); error.status = 503; throw error }
  active++
  try { return await derive(password, salt, 64, options) } finally { active-- }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const result = await key(password, salt)
  return `scrypt$131072$8$1$${salt}$${result.toString('hex')}`
}
export async function verifyPassword(password, encoded) {
  const valid = /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded || '')
  const parts = valid ? encoded.split('$') : []
  // Unknown accounts still perform the same expensive computation.
  const result = await key(password, valid ? parts[4] : '0'.repeat(32))
  return timingSafeEqual(result, Buffer.from(valid ? parts[5] : '0'.repeat(128), 'hex')) && valid
}
