import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'

test('profile is session-owned, normalized, unique, validated and revision protected', async () => {
  const db = new PGlite(); let app
  try {
    await db.exec('CREATE ROLE collection_app')
    const dir = new URL('../backend/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'))
    const tokens = ['d'.repeat(64), 'e'.repeat(64)], ids = []
    for (let i = 0; i < 2; i++) {
      const id = (await db.query('INSERT INTO accounts.users(email,email_verified_at) VALUES($1,now()) RETURNING id', [`profile${i}@example.test`])).rows[0].id
      ids.push(id)
      await db.query('INSERT INTO accounts.sessions(token_hash,user_id) VALUES($1,$2)', [createHash('sha256').update(tokens[i]).digest('hex'), id])
      await db.query('INSERT INTO collection.profiles(id,username,display_name) VALUES($1,$2,$3)', [id, `person${i}`, `Person ${i}`])
    }
    await db.exec('SET ROLE collection_app')
    app = createApp({ query: (...args) => db.query(...args) }, { origin: 'https://test.example' })
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${app.address().port}/api/collection/profile`
    const call = (data, user = 0, origin = 'https://test.example') => fetch(url, { method: data ? 'PATCH' : 'GET', headers: { Cookie: `__Host-koleksiyonum_session=${tokens[user]}`, Origin: origin, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined })
    assert.equal((await fetch(url)).status, 401)
    const profile = (await (await call()).json()).profile
    assert.deepEqual(Object.keys(profile).sort(), ['bio','display_name','id','revision','username'])
    assert.equal(profile.id, ids[0])
    assert.equal((await call({ revision: 1, bio: 'bad' }, 0, 'https://evil.example')).status, 403)
    for (const patch of [{ id: ids[1] }, { is_public: true }, { username: 'bad name' }, { username: '1bad' }, { username: 'ab' }, { username: null }, { display_name: ' ' }, { display_name: 'x'.repeat(81) }, { bio: 'x'.repeat(161) }]) {
      assert.equal((await call({ revision: 1, ...patch })).status, 400)
    }
    assert.equal((await call({ revision: 1, username: 'PERSON1' })).status, 409)
    const saved = await call({ revision: 1, username: 'New.Name_', display_name: ' Yeni İsim ', bio: 'Kitaplar\nFilmler' })
    assert.equal(saved.status, 200)
    const updated = (await saved.json()).profile
    assert.equal(updated.username, 'new.name_'); assert.equal(updated.display_name, 'Yeni İsim'); assert.equal(updated.revision, 2)
    assert.equal((await call({ revision: 1, bio: 'stale' })).status, 409)
    assert.equal((await (await call()).json()).profile.bio, 'Kitaplar\nFilmler')
    assert.equal((await (await call(undefined, 1)).json()).profile.username, 'person1')
    await assert.rejects(db.query('UPDATE collection.profiles SET bio=$1', ['forbidden']), /permission denied/)
    await db.exec('RESET ROLE')
    await db.query('UPDATE accounts.sessions SET expires_at=now()-interval \'1 hour\' WHERE user_id=$1', [ids[0]])
    await db.exec('SET ROLE collection_app')
    assert.equal((await call()).status, 401)
  } finally { if (app) await new Promise(resolve => app.close(resolve)); await db.close() }
})
