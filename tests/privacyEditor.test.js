import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('policy is public to read but only admin can publish; stale writes and reruns preserve content', async () => {
  const db = new PGlite()
  const admin = '00000000-0000-0000-0000-000000000001'
  const member = '00000000-0000-0000-0000-000000000002'
  const sql = await readFile(new URL('../supabase/migrations/20261113_privacy_editor.sql', import.meta.url),'utf8')
  const get = async () => (await db.query('select public.get_privacy_policy() as p')).rows[0].p
  const save = version => db.query("select public.save_privacy_policy('New title','New content',$1)",[version])
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema collection_private; create table collection_private.app_admins(user_id uuid primary key);
      grant usage on schema auth, public to anon,authenticated;`)
    await db.query('insert into collection_private.app_admins values($1)',[admin])
    await db.exec(sql)
    await db.exec('set role anon')
    assert.equal((await get()).version,1)
    await assert.rejects(save(1),/permission denied/)
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member])
    await assert.rejects(save(1),/Admin permission/)
    await assert.rejects(db.query('select * from collection_private.site_privacy'),/permission denied/)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin])
    await save(1)
    await assert.rejects(save(1),/Policy changed/)
    await assert.rejects(db.query("select public.save_privacy_policy('','',2)"),/Invalid/)
    await db.exec('reset role')
    await db.exec(sql)
    assert.equal((await get()).body,'New content')
    assert.equal((await get()).version,2)
  } finally { await db.close() }
})
