import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('announcements enforce admin identity, preserve reads and reject stale edits', async () => {
  const db = new PGlite()
  const admin = '0fccb04b-e2a1-4cbb-914a-6ba2abdce9f6'
  const member = '00000000-0000-0000-0000-000000000002'
  const sql = await readFile(new URL('../supabase/migrations/20261105_admin_announcements.sql', import.meta.url), 'utf8')
  const as = async id => {
    await db.exec('reset role; set role authenticated;')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
  }
  const list = async () => (await db.query('select public.get_announcements() as data')).rows[0].data
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon;`)
    await db.query('insert into auth.users values($1,$3),($2,$4)', [admin, member,
      JSON.stringify({ announcement_reads: ['2026-11-05-comments'] }), JSON.stringify({ username: 'feyza', is_admin: true })])
    await db.exec(sql)
    await as(member)
    assert.equal((await db.query('select public.is_app_admin() as yes')).rows[0].yes, false)
    await assert.rejects(db.query("select public.save_announcement(null,'title','body')"), /yetkin/)
    await assert.rejects(db.query('select * from collection_private.app_admins'), /permission denied/)
    const original = await list()
    assert.equal(original.unread, 6)
    await db.query('select public.read_announcement($1)', [original.entries[0].id])
    assert.equal((await list()).unread, 5)
    await as(admin)
    assert.equal((await db.query('select public.is_app_admin() as yes')).rows[0].yes, true)
    assert.equal((await list()).unread, 5)
    const id = (await db.query("select public.save_announcement(null,'New','Body') as id")).rows[0].id
    const entry = (await list()).entries.find(e => e.id === id)
    await db.query('select public.read_announcement($1)', [id])
    await db.query("select public.save_announcement($1,'Edited','Body','', $2)", [id, entry.updated_at])
    const edited = (await list()).entries.find(e => e.id === id)
    assert.ok(edited.read_at)
    assert.equal(edited.published_at, entry.published_at)
    await assert.rejects(db.query("select public.save_announcement($1,'Stale','Body','', $2)", [id, entry.updated_at]), /Listeyi/)
    await as(member)
    assert.equal((await list()).entries.find(e => e.id === id).read_at, null)
    await assert.rejects(db.query('select public.delete_announcement($1,$2)', [id, edited.updated_at]), /yetkin/)
    await as(admin)
    await db.query('select public.delete_announcement($1,$2)', [id, edited.updated_at])
    await db.exec('reset role')
    await db.exec(sql)
    await as(admin)
    assert.ok(!(await list()).entries.some(e => e.id === id))
    assert.equal((await list()).unread, 5)
    await db.exec('reset role; set role anon;')
    await assert.rejects(list(), /permission denied/)
  } finally { await db.close() }
})
