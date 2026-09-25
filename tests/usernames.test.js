import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('usernames are unique regardless of casing and outer spaces; conflicts preserve records', async () => {
  const db = new PGlite()
  try {
    const sql = await readFile(new URL('../supabase/migrations/20260926_unique_usernames.sql', import.meta.url), 'utf8')
    await db.exec("create role anon; create role authenticated; create table public.profiles(id int primary key, display_name text); insert into public.profiles values (1, 'Feyza'), (2, ' feyza ')")
    await assert.rejects(db.exec(sql), /Aynı kullanıcı/)
    await db.exec('rollback')
    assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n, 2)
    await db.exec("update public.profiles set display_name = 'Other' where id = 2")
    await db.exec(sql)
    await db.exec(sql)
    await assert.rejects(db.exec("insert into public.profiles values (3, ' FEYZA ' )"), /unique/)
    await assert.rejects(db.exec("update public.profiles set display_name = 'feyza' where id = 2"), /unique/)
    await db.exec('set role anon')
    assert.equal((await db.query("select public.is_username_available('fEyZa') as available")).rows[0].available, false)
    assert.equal((await db.query("select public.is_username_available('NewName') as available")).rows[0].available, true)
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/)
  } finally { await db.close() }
})
