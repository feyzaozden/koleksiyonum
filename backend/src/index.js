import pg from 'pg'
import { createApp } from './app.js'

for (const name of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
  if (!process.env[name]) throw new Error(`Missing configuration: ${name}`)
}
const pool = new pg.Pool({ max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, query_timeout: 3000 })
pool.on('error', () => console.error('Database connection interrupted'))
if (!process.env.AUTH_ORIGIN) throw new Error('Missing configuration: AUTH_ORIGIN')
const app = createApp(pool, { origin: process.env.AUTH_ORIGIN, allowLocalRegistration: process.env.AUTH_LOCAL_REGISTRATION === 'true' })
app.requestTimeout = 10000
app.headersTimeout = 10000
app.listen(3000, '0.0.0.0', () => console.log('Independent backend listening on port 3000'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  app.close(async () => { await pool.end(); process.exit(0) })
  setTimeout(() => process.exit(1), 8000).unref()
})
