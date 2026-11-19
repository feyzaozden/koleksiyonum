import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'
import { createCatalog } from '../backend/src/catalog.js'

test('catalog enforces sessions and verified metadata; progress is validated and versioned atomically', async () => {
  const db = new PGlite(); let app, providerCalls = 0
  try {
    await db.exec('CREATE ROLE collection_app')
    const directory = new URL('../backend/migrations/', import.meta.url)
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
    const token = 'c'.repeat(64), hash = createHash('sha256').update(token).digest('hex')
    const actor = (await db.query("INSERT INTO accounts.users(email,email_verified_at) VALUES('catalog@example.test',now()) RETURNING id")).rows[0].id
    await db.query('INSERT INTO accounts.sessions(token_hash,user_id) VALUES($1,$2)', [hash, actor])
    await db.exec('SET ROLE collection_app')
    const catalog = createCatalog({ token: 'test-only', now: () => new Date('2026-01-01T12:00:00Z'), fetchImpl: async url => {
      providerCalls++
      if (url.pathname.includes('/search/')) return Response.json({ results: [{ id: 7, name: 'Dizi', first_air_date: '2020-01-01' }, { id: 8, name: 'Future', first_air_date: '2026-12-01' }] })
      return Response.json({ id: 7, name: 'Dizi', first_air_date: '2020-01-01', poster_path: '/poster.jpg', created_by: [{ name: 'Yapımcı' }] })
    } })
    app = createApp({ query: (...args) => db.query(...args) }, { origin: 'https://test.example', catalog })
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${app.address().port}/api/collection`
    const call = (suffix, method = 'GET', body) => fetch(base + suffix, { method, headers: { Cookie: `__Host-koleksiyonum_session=${token}`, Origin: 'https://test.example', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    assert.equal((await fetch(base + '/catalog?category=dizi&q=Dizi')).status, 401)
    assert.equal(providerCalls, 0)
    const results = await (await call('/catalog?category=dizi&q=Dizi')).json()
    assert.equal(results.results.length, 1)
    assert.equal((await call('/catalog', 'POST', { category: 'dizi', source_id: 7, title: 'Forged' })).status, 400)
    let response = await call('/catalog', 'POST', { category: 'dizi', source_id: 7, note: 'Kişisel not' })
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()))
    let item = (await response.json()).item
    assert.equal(item.title, 'Dizi'); assert.equal(item.source, 'tmdb'); assert.equal(item.poster_path, '/poster.jpg')
    assert.equal((await call('/catalog', 'POST', { category: 'dizi', source_id: 7 })).status, 409)
    assert.equal((await call('/' + item.id, 'PATCH', { revision: item.revision, title: 'Forged' })).status, 400)
    for (const progress of [{ season: 1 }, { season: 1, position: 4, episodes: { 1: 3 } }, { season: 2, position: 1, seasons: 1 }, { position: -2 }, { season: 1.5, position: 2 }, { episodes: [] }, { unknown: 2 }]) {
      assert.equal((await call('/' + item.id, 'PATCH', { revision: item.revision, progress })).status, 400)
    }
    response = await call('/' + item.id, 'PATCH', { revision: item.revision, status: 'devam', progress: { season: 1, position: 5, episodes: { 1: 10 } } })
    assert.equal(response.status, 200); item = (await response.json()).item
    assert.equal(item.progress.position, 5); assert.equal(item.revision, 2)
    assert.equal((await call('/' + item.id, 'PATCH', { revision: 1, progress: {} })).status, 409)
    assert.equal((await call('/' + item.id, 'PATCH', { revision: 2, status: 'bitti', end_date: '2099-01-01' })).status, 400)
    assert.equal((await call('/' + item.id, 'PATCH', { revision: 2, status: 'bitti', end_date: '2020-01-02' })).status, 200)
    assert.equal((await call('', 'POST', { category: 'kitap', title: 'Bad', progress: { position: 11, total: 10 } })).status, 400)
    assert.equal((await call('', 'POST', { category: 'muzik', title: 'Bad', progress: { position: 1 } })).status, 400)
    response = await call('', 'POST', { category: 'kitap', title: 'Good', progress: { position: 50, total: 100 } })
    assert.equal(response.status, 201)
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT used FROM collection.daily_item_usage WHERE user_id=$1', [actor])).rows[0].used, 2)
  } finally { if (app) await new Promise(resolve => app.close(resolve)); await db.close() }
})
