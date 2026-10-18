import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('notifications preserve privacy, read ownership, deduplication and deleted item history', async () => {
  const db = new PGlite()
  const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const as = async (n) => {
    await db.exec('reset role; set role authenticated;')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id(n)])
  }
  const vote = (value, item = 1) => db.query('select * from public.set_item_reaction($1, $2)', [item, value])
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `)
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260925_friendships.sql', import.meta.url), 'utf8'))
    await db.exec(`
      grant select, insert, update, delete on public.items, public.profiles to authenticated;
      grant usage, select on all sequences in schema public to authenticated;
    `)
    for (let n = 1; n <= 4; n++) await db.query('insert into auth.users(id,email) values($1,$2)', [id(n), `user${n}@example.test`])
    await db.query("insert into public.items(user_id,category,title) values($1,'film','Existing film'),($2,'kitap','Private book')", [id(1), id(4)])
    await db.query("insert into public.friendships(requester_id,recipient_id,status) values($1,$2,'accepted'),($1,$3,'accepted'),($1,$4,'pending')", [id(1), id(2), id(3), id(4)])
    const migration = await readFile(new URL('../supabase/migrations/20261013_item_reactions.sql', import.meta.url), 'utf8')
    await db.exec(migration)


    const notifications = await readFile(new URL('../supabase/migrations/20261018_reaction_notifications.sql', import.meta.url), 'utf8')
    await db.exec(notifications)
    await db.exec(notifications)
    const inbox = async () => (await db.query('select public.get_reaction_notifications() as inbox')).rows[0].inbox
    await as(2)
    await vote(1)
    assert.equal((await inbox()).entries.length, 0)
    await as(1)
    let data = await inbox()
    assert.equal(data.unread, 1)
    assert.equal(data.entries.length, 1)
    assert.deepEqual(Object.keys(data.entries[0]).sort(), ['id','item_id','title','category','reaction','created_at','read_at'].sort())
    const nid = data.entries[0].id
    await as(2)
    await db.query('select public.read_reaction_notification($1)',[nid])
    await as(1)
    assert.equal((await inbox()).unread,1,'another account cannot mark owner notification')
    await db.query('select public.read_reaction_notification($1)',[nid])
    await as(2)
    await vote(-1)
    await vote(null)
    await vote(1)
    await as(1)
    data = await inbox()
    assert.equal(data.unread,0,'switch and re-add cannot rearm read notification')
    assert.equal(data.entries.length,1)
    assert.equal(data.entries[0].reaction,1)
    await assert.rejects(db.query('select * from collection_private.reaction_notifications'), /permission denied/)
    await as(3)
    await vote(-1)
    await as(1)
    assert.equal((await inbox()).unread,1)
    const newest = (await inbox()).entries[0].id
    const older = (await db.query('select public.get_reaction_notifications($1) as inbox',[newest])).rows[0].inbox
    assert.equal(older.entries.length,1)
    await db.query('delete from public.items where id=1')
    data = await inbox()
    assert.equal(data.entries.length,2)
    assert.ok(data.entries.every(n=>n.item_id === null))
    await db.exec('reset role')
    await db.exec(notifications)
    await as(1)
    assert.equal((await inbox()).entries.length,2)
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(inbox(),/permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(inbox(),/giriş yap/)
  } finally { await db.close() }
})
