import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('independent core enforces identity and integrity, and denies unimplemented API access', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE collection_app')
    await db.exec(await readFile(new URL('../backend/migrations/001_core.sql', import.meta.url), 'utf8'))
    const user = (await db.query("INSERT INTO accounts.users(email) VALUES('one@example.test') RETURNING id")).rows[0].id
    const other = (await db.query("INSERT INTO accounts.users(email) VALUES('two@example.test') RETURNING id")).rows[0].id
    await assert.rejects(db.query("INSERT INTO accounts.users(email) VALUES('ONE@example.test')"), /unique/)
    await db.query("INSERT INTO collection.profiles(id,username,display_name) VALUES($1,'first_user','First'),($2,'second_user','Second')", [user,other])
    await assert.rejects(db.query("UPDATE collection.profiles SET username='First' WHERE id=$1",[user]), /check constraint/)
    await assert.rejects(db.query("UPDATE collection.profiles SET username='first_user' WHERE id=$1",[other]), /unique/)
    assert.equal((await db.query('SELECT is_public FROM collection.profiles WHERE id=$1',[user])).rows[0].is_public,false)
    await db.query('INSERT INTO collection.friendships(requester_id,recipient_id) VALUES($1,$2)',[user,other])
    await assert.rejects(db.query('INSERT INTO collection.friendships(requester_id,recipient_id) VALUES($1,$2)',[other,user]),/unique/)
    await assert.rejects(db.query('INSERT INTO collection.friendships(requester_id,recipient_id) VALUES($1,$1)',[user]),/check constraint/)
    await db.query("INSERT INTO collection.items(user_id,category,title,dedupe_key) VALUES($1,'film','Test','same')",[user])
    await assert.rejects(db.query("INSERT INTO collection.items(user_id,category,title,dedupe_key) VALUES($1,'film','Test','same')",[user]),/unique/)
    await assert.rejects(db.query("INSERT INTO collection.items(user_id,category,title,start_date,end_date) VALUES($1,'film','Dates','2020-02-02','2020-02-01')",[user]),/check constraint/)
    await db.exec('SET ROLE collection_app')
    for (const table of ['accounts.users','collection.profiles','collection.items','collection.friendships']) await assert.rejects(db.query(`SELECT * FROM ${table}`),/permission denied/)
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM collection.items')).rows[0].n,1)
  } finally { await db.close() }
})
