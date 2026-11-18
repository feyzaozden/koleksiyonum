import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCollection, saveItem, removeItem } from '../src/independent/client.js'

test('collection loads beyond the first API page and propagates expired sessions', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(options.credentials, 'same-origin')
    const offset = Number(new URL(url, 'http://local').searchParams.get('offset'))
    return Response.json({ total: 51, items: Array.from({ length: offset ? 1 : 50 }, (_, index) => ({ id: String(offset + index) })) })
  })
  assert.equal((await loadCollection()).length, 51)
  assert.equal(calls.length, 2)
  globalThis.fetch.mock.mockImplementation(async () => new Response('', { status: 401 }))
  await assert.rejects(loadCollection(), error => error.status === 401)
})

test('writes send session cookies and revisions and preserve backend conflict messages', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) })
    return Response.json({ item: { id: '12', title: 'Kitap', revision: 2 } })
  })
  const saved = await saveItem({ category: 'kitap', title: 'Kitap' })
  assert.equal(saved.id, '12')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].credentials, 'same-origin')
  assert.equal('revision' in calls[0].body, false)
  await saveItem({ title: 'Yeni başlık' }, { id: '12', revision: 2 })
  assert.equal(calls[1].method, 'PATCH')
  assert.equal(calls[1].body.revision, 2)
  await removeItem({ id: '12', revision: 3, title: 'gönderilmemeli' })
  assert.equal(calls[2].method, 'DELETE')
  assert.deepEqual(calls[2].body, { revision: 3 })
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: 'Kayıt değişmiş. Listeyi yenile.' }, { status: 409 }))
  await assert.rejects(saveItem({ title: 'Eski' }, { id: '12', revision: 1 }), error => error.status === 409 && error.message === 'Kayıt değişmiş. Listeyi yenile.')
})
