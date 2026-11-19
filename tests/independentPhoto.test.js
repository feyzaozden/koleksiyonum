import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'
import { normalizePhoto } from '../backend/src/profile-photo.js'
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp')

test('photo decoding rejects fake/SVG files and creates a bounded WebP', async () => {
  for (const bytes of [Buffer.from('not an image'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')]) {
    await assert.rejects(normalizePhoto(bytes), error => error.status === 400)
  }
  const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: 'red' } }).jpeg().toBuffer()
  const output = await normalizePhoto(input), meta = await sharp(output).metadata()
  assert.equal(meta.format, 'webp'); assert.equal(meta.width, 512); assert.equal(meta.height, 512)
  assert.equal(meta.exif, undefined); assert.ok(output.length < 524288)
})

test('photo API enforces ownership, CSRF, revisions, replacement and removal', async () => {
  const db = new PGlite(); let app
  try {
    await db.exec('CREATE ROLE collection_app')
    const dir = new URL('../backend/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'))
    const tokens = ['1'.repeat(64), '2'.repeat(64)]
    for (let i = 0; i < 2; i++) {
      const id = (await db.query('INSERT INTO accounts.users(email,email_verified_at) VALUES($1,now()) RETURNING id',[`photo${i}@example.test`])).rows[0].id
      await db.query('INSERT INTO collection.profiles(id,username,display_name) VALUES($1,$2,$2)',[id, `photo${i}`])
      await db.query('INSERT INTO accounts.sessions(token_hash,user_id) VALUES($1,$2)',[createHash('sha256').update(tokens[i]).digest('hex'), id])
    }
    await db.exec('SET ROLE collection_app')
    app = createApp({ query: (...args) => db.query(...args) }, { origin: 'https://test.example' })
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${app.address().port}/api/collection/profile/photo`
    const image = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'blue' } }).png().toBuffer()
    const call = (method, revision = 1, body, user = 0, origin = 'https://test.example') => fetch(url, { method, headers: { Cookie: `__Host-koleksiyonum_session=${tokens[user]}`, Origin: origin, 'X-Profile-Revision': String(revision), 'Content-Type': 'image/png' }, body })
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await call('GET')).status, 404)
    assert.equal((await call('PUT', 1, image, 0, 'https://evil.example')).status, 403)
    assert.equal((await call('PUT', 1, Buffer.from('fake'))).status, 400)
    let saved = await call('PUT', 1, image)
    assert.equal(saved.status, 200, await saved.clone().text())
    assert.equal((await saved.json()).profile.has_photo, true)
    const response = await call('GET')
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp')
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width, 512)
    assert.equal((await call('GET', 1, undefined, 1)).status, 404)
    assert.equal((await call('PUT', 1, image)).status, 409)
    saved = await call('PUT', 2, image); assert.equal(saved.status, 200)
    assert.equal((await call('DELETE', 2)).status, 409)
    assert.equal((await call('DELETE', 3)).status, 200)
    assert.equal((await call('GET')).status, 404)
    await assert.rejects(db.query('SELECT * FROM collection.profile_photos'), /permission denied/)
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM collection.profile_photos')).rows[0].n, 0)
  } finally { if (app) await new Promise(resolve => app.close(resolve)); await db.close() }
})
