import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMovieHandler, createSeriesHandler } from '../server/movies.js'

const env = { TMDB_READ_ACCESS_TOKEN: 'secret-token', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-key' }
const now = () => new Date('2026-10-13T12:00:00Z')
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })

test('series search uses TV fields and filters future first-air years', async () => {
  const handler = createSeriesHandler({ env, now, fetchImpl: async (url) => {
    if (String(url).includes('/auth/v1/user')) return json({ id: 'user-1' })
    assert.equal(url.pathname, '/3/search/tv')
    assert.equal(url.searchParams.get('language'), 'tr-TR')
    assert.equal(url.searchParams.get('include_adult'), 'false')
    return json({ results: [
      { id: 1, name: 'Dizi', original_name: 'Series', first_air_date: '2011-02-09', poster_path: '/poster.jpg' },
      { id: 2, name: 'Future', first_air_date: '2027-01-01', release_date: '2000-01-01' },
      { id: 3, name: 'Adult', adult: true },
      { id: 4, original_name: 'Unknown', first_air_date: '' },
    ] })
  } })
  const response = await invoke(handler, '/api/series?q=Dizi')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.results.map((item) => item.id), [1, 4])
  assert.equal(response.body.results[0].title, 'Dizi')
  assert.equal(response.body.results[0].year, '2011')
  assert.equal(response.body.results[1].title, 'Unknown')
  assert.equal(response.body.results[1].year, '')
})

test('series details use creators and first air date, without importing watched progress', async () => {
  const handler = createSeriesHandler({ env, now, fetchImpl: async (url) => {
    if (String(url).includes('/auth/v1/user')) return json({ id: 'user-1' })
    assert.equal(url.pathname, '/3/tv/12')
    assert.equal(url.searchParams.has('append_to_response'), false)
    return json({ id: 12, name: 'Dizi', first_air_date: '2011-01-01', last_air_date: '2026-01-01',
      created_by: [{ name: 'A' }, { name: 'A' }, { name: 'B' }], number_of_seasons: 5, number_of_episodes: 90, vote_average: 9 })
  } })
  const response = await invoke(handler, '/api/series?id=12')
  assert.equal(response.body.series.creator, 'A, B')
  assert.equal(response.body.series.year, '2011')
  assert.equal(response.body.series.rating, undefined)
  assert.equal(response.body.series.progress, undefined)
  assert.equal(response.body.movie, undefined)
})

test('series missing creators are editable, while future details and expired sessions are rejected', async () => {
  for (const future of [false, true]) {
    const handler = createSeriesHandler({ env, now, fetchImpl: async (url) => String(url).includes('/auth/v1/user')
      ? json({ id: 'user-1' }) : json({ id: 12, name: 'Dizi', first_air_date: future ? '2027-01-01' : '' }) })
    const response = await invoke(handler, '/api/series?id=12')
    assert.equal(response.statusCode, future ? 400 : 200)
    if (!future) assert.equal(response.body.series.creator, '')
  }
  let calls = 0
  const handler = createSeriesHandler({ env, fetchImpl: async () => { calls++; return json({}, 401) } })
  const response = await invoke(handler, '/api/series?q=Dizi')
  assert.equal(response.statusCode, 401)
  assert.equal(calls, 1)
})

test('film and series handlers keep independent caches for the same ID', async () => {
  const options = { env, now, fetchImpl: async (url) => String(url).includes('/auth/v1/user')
    ? json({ id: 'user-1' }) : json({ id: 12, title: 'Film', name: 'Dizi' }) }
  const film = await invoke(createMovieHandler(options), '/api/movies?id=12')
  const series = await invoke(createSeriesHandler(options), '/api/series?id=12')
  assert.equal(film.body.movie.title, 'Film')
  assert.equal(series.body.series.title, 'Dizi')
})
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
