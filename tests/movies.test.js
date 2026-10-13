import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMovieHandler } from '../server/movies.js'

const env = { TMDB_READ_ACCESS_TOKEN: 'secret-token', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-key' }
const now = () => new Date('2026-10-13T12:00:00Z')
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
async function invoke(handler, url = '/api/movies?q=Matrix', headers = { authorization: 'Bearer user-jwt' }, method = 'GET') {
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = JSON.parse(body) } }
  await handler({ method, url, headers }, res)
  return res
}

test('movie API rejects unauthenticated, invalid and unsupported requests without upstream calls', async () => {
  const handler = createMovieHandler({ env, fetchImpl: () => { throw new Error('Unexpected fetch') } })
  assert.equal((await invoke(handler, '/api/movies?q=Matrix', {})).statusCode, 401)
  assert.equal((await invoke(handler, '/api/movies?id=../config')).statusCode, 400)
  assert.equal((await invoke(handler, '/api/movies?q=a')).statusCode, 400)
  assert.equal((await invoke(handler, '/api/movies?q=Matrix', {}, 'POST')).statusCode, 405)
  assert.equal((await invoke(createMovieHandler({ env: {} }))).statusCode, 503)
})

test('movie search normalizes metadata, rejects future/adult results and rechecks auth even on cache hits', async () => {
  let authCalls = 0
  let searchCalls = 0
  const handler = createMovieHandler({ env, now, fetchImpl: async (url, options) => {
    if (String(url).includes('/auth/v1/user')) {
      authCalls++
      assert.equal(options.headers.Authorization, 'Bearer user-jwt')
      return json({ id: 'user-1' })
    }
    searchCalls++
    assert.equal(url.origin, 'https://api.themoviedb.org')
    assert.equal(url.searchParams.get('language'), 'tr-TR')
    assert.equal(url.searchParams.get('include_adult'), 'false')
    assert.equal(options.headers.Authorization, 'Bearer secret-token')
    return json({ results: [
      { id: 1, title: 'Film', original_title: 'Movie', release_date: '2026-01-01', poster_path: '/poster.jpg' },
      { id: 2, title: 'Future', release_date: '2027-01-01' },
      { id: 3, title: 'Adult', adult: true },
      { id: 4, title: 'Unknown', poster_path: 'https://other.example/a.jpg' },
    ] })
  } })
  const response = await invoke(handler)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.results.map((m) => m.id), [1, 4])
  assert.equal(response.body.results[0].poster, 'https://image.tmdb.org/t/p/w185/poster.jpg')
  assert.equal(response.body.results[1].poster, null)
  assert.equal(response.body.results[1].year, '')
  await invoke(handler)
  assert.equal(authCalls, 2)
  assert.equal(searchCalls, 1)
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
})

test('details obtain directors without replacing personal ratings or progress', async () => {
  const handler = createMovieHandler({ env, now, fetchImpl: async (url) => {
    if (String(url).includes('/auth/v1/user')) return json({ id: 'user-1' })
    assert.equal(url.pathname, '/3/movie/12')
    assert.equal(url.searchParams.get('append_to_response'), 'credits')
    return json({ id: 12, title: 'Film', release_date: '2014-01-01', vote_average: 9, credits: { crew: [
      { job: 'Director', name: 'A' }, { job: 'Director', name: 'A' }, { job: 'Director', name: 'B' }, { job: 'Writer', name: 'C' },
    ] } })
  } })
  const response = await invoke(handler, '/api/movies?id=12')
  assert.equal(response.body.movie.creator, 'A, B')
  assert.equal(response.body.movie.year, '2014')
  assert.equal(response.body.movie.rating, undefined)
  assert.equal(response.body.movie.progress, undefined)
})

test('expired sessions never reach TMDB', async () => {
  let count = 0
  const handler = createMovieHandler({ env, fetchImpl: async () => { count++; return json({}, 401) } })
  assert.equal((await invoke(handler)).statusCode, 401)
  assert.equal(count, 1)
})

test('provider failures and timeouts are sanitized and not cached', async () => {
  for (const status of [401, 404, 429, 500]) {
    const handler = createMovieHandler({ env, fetchImpl: async (url) => String(url).includes('/auth/v1/user')
      ? json({ id: 'user-1' }) : json({ error: 'secret-token' }, status) })
    const response = await invoke(handler)
    assert.equal(response.statusCode, status === 404 || status === 429 ? status : 502)
    assert.ok(!JSON.stringify(response.body).includes('secret-token'))
  }
  const handler = createMovieHandler({ env, fetchImpl: async () => { throw new Error('secret-token') } })
  assert.equal((await invoke(handler)).statusCode, 503)
})

test('future movie details cannot bypass the year restriction', async () => {
  const handler = createMovieHandler({ env, now, fetchImpl: async (url) => String(url).includes('/auth/v1/user')
    ? json({ id: 'user-1' }) : json({ id: 12, title: 'Future', release_date: '2027-01-01' }) })
  assert.equal((await invoke(handler, '/api/movies?id=12')).statusCode, 400)
})
