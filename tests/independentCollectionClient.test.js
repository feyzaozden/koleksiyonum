import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCollection } from '../src/independent/client.js'

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
