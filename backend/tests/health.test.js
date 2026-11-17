import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'

test('health checks database, handles outages without leaking details, rejects unknown routes', async () => {
  let unavailable = false, queries = 0
  const app = createApp({ query: async sql => { queries++; assert.equal(sql, 'SELECT 1'); if (unavailable) throw new Error('private-host:password'); return {} } })
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${app.address().port}`
  try {
    assert.equal((await fetch(base + '/health')).status, 200)
    assert.equal(queries, 0)
    assert.equal((await fetch(base + '/health/db')).status, 200)
    assert.equal(queries, 1)
    unavailable = true
    const failed = await fetch(base + '/health/db')
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { status: 'unavailable', database: 'disconnected' })
    assert.equal((await fetch(base + '/users')).status, 404)
    assert.equal((await fetch(base + '/health/db', { method: 'POST' })).status, 405)
  } finally { await new Promise(resolve => app.close(resolve)) }
})
