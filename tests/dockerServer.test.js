import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.js'

test('production server serves SPA, routes authenticated APIs and excludes private files', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'koleksiyonum-server-'))
  await mkdir(join(dist, 'assets'))
  await writeFile(join(dist, 'index.html'), '<html>app</html>')
  await writeFile(join(dist, 'assets', 'app.js'), 'export const ok=true')
  await writeFile(join(dist, '.env'), 'private')
  const app = createApp({ dist, env: {} })
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${app.address().port}`
  try {
    const health = await fetch(base + '/healthz'); assert.deepEqual(await health.json(), { ok: true })
    const page = await fetch(base + '/people/example'); assert.equal(await page.text(), '<html>app</html>')
    const asset = await fetch(base + '/assets/app.js'); assert.match(asset.headers.get('cache-control'), /immutable/)
    const head = await fetch(base + '/', { method: 'HEAD' }); assert.equal(await head.text(), '')
    for (const path of ['/.env', '/server/app.js', '/assets/missing.js', '/api/missing', '/%2eenv']) assert.equal((await fetch(base + path)).status, 404)
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405)
    for (const path of ['/api/movies?q=test','/api/series?q=test','/api/music?q=test']) assert.equal((await fetch(base + path)).status, 401)
    assert.equal((await fetch(base + '/api/items', { method:'POST', body:'{}' })).status, 401)
  } finally {
    await new Promise(resolve => app.close(resolve))
    await rm(dist, { recursive: true, force: true })
  }
})
