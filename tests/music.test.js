import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMusicHandler } from '../server/music.js'

const recording = '11111111-1111-4111-8111-111111111111'
const release = '22222222-2222-4222-8222-222222222222'
const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SECRET_KEY: 'sb_secret_test', YOUTUBE_API_KEY: 'yt-secret' }
async function call(handler, method, body, url = '/api/music', authorization = 'Bearer session') {
  const res = { statusCode: 0, setHeader() {}, end(value) { this.body = JSON.parse(value) } }
  await handler({ method, body, url, headers: { authorization } }, res)
  return res
}
test('music creation verifies catalog and session, ignores injected owner/cover/video', async () => {
  let payload
  const handler = createMusicHandler({ env, fetchImpl: async (url, options) => {
    if (String(url).includes('/auth/')) return Response.json({ id: 'actual-owner' })
    if (String(url).includes('musicbrainz.org')) return Response.json({ id: recording, title: 'Song', 'artist-credit': [{ name: 'Artist' }], releases: [{ id: release, title: 'Album', date: '2020' }] })
    payload = JSON.parse(options.body)
    return Response.json([{ id: 42, ...payload }])
  } })
  const response = await call(handler, 'POST', { music_recording_id: recording, music_release_id: release, title: 'Fake', user_id: 'victim', youtube_id: 'aaaaaaaaaaa', note: 'Note', rating: 7 })
  assert.equal(response.statusCode, 201)
  assert.equal(payload.user_id, 'actual-owner')
  assert.equal(payload.title, 'Song')
  assert.equal(payload.album, 'Album')
  assert.equal(payload.note, 'Note')
  assert.equal(payload.youtube_id, undefined)
  assert.equal(payload.source_id, undefined)
  assert.ok(!JSON.stringify(response.body).includes('sb_secret'))
})
test('music API rejects missing auth, invalid IDs, unrelated releases and non-embeddable videos', async () => {
  const handler = createMusicHandler({ env, fetchImpl: async url => {
    if (String(url).includes('/auth/')) return Response.json({ id: 'owner' })
    if (String(url).includes('musicbrainz')) return Response.json({ id: recording, releases: [] })
    if (String(url).includes('youtube')) return Response.json({ items: [{ status: { embeddable: false } }] })
    throw new Error('Unexpected database mutation')
  } })
  assert.equal((await call(handler, 'GET', null, '/api/music?q=test', '')).statusCode, 401)
  assert.equal((await call(handler, 'POST', { music_recording_id: '../' })).statusCode, 400)
  assert.equal((await call(handler, 'POST', { music_recording_id: recording, music_release_id: release })).statusCode, 400)
  assert.equal((await call(handler, 'PATCH', { item_id: 1, video_id: 'aaaaaaaaaaa' })).statusCode, 400)
})
test('video selection updates only the authenticated owner music item', async () => {
  let savedUrl, payload
  const handler = createMusicHandler({ env, fetchImpl: async (url, options) => {
    if (String(url).includes('/auth/')) return Response.json({ id: 'owner' })
    if (String(url).includes('youtube')) return Response.json({ items: [{ status: { embeddable: true } }] })
    savedUrl = String(url); payload = JSON.parse(options.body)
    return Response.json([])
  } })
  const response = await call(handler, 'PATCH', { item_id: 9, video_id: 'abcdefghijk', user_id: 'other' })
  assert.equal(response.statusCode, 404)
  assert.match(savedUrl, /user_id=eq.owner&category=eq.muzik/)
  assert.deepEqual(payload, { youtube_id: 'abcdefghijk' })
})
