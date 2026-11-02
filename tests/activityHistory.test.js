import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('activity history captures committed operations and protects private records', async () => {
  const db = new PGlite()
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
    const migration = await readFile(new URL('../supabase/migrations/20260925_friendships.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration) // Reapplying must preserve data and policies.
    await db.exec(await readFile(new URL('../supabase/migrations/20260929_item_progress.sql', import.meta.url), 'utf8'))
    await db.exec(`
      grant select, insert, update, delete on public.items, public.profiles to authenticated;
      grant select on public.items to anon;
      grant usage, select on all sequences in schema public to authenticated;
      insert into auth.users(id, email) values
        ('00000000-0000-0000-0000-000000000001', 'a@example.test'),
        ('00000000-0000-0000-0000-000000000002', 'b@example.test'),
        ('00000000-0000-0000-0000-000000000003', 'c@example.test');
      insert into public.items(user_id, category, title, rating)
        select id, 'kitap', 'Shared book', case when email like 'a%' then 6 when email like 'b%' then 8 else 1 end from auth.users;
    `)
    const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
    const as = async (n) => {
      await db.exec(`reset role; set role authenticated;`)
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id(n)])
    }

    await db.exec(await readFile(new URL('../supabase/migrations/20261013_item_reactions.sql',import.meta.url),'utf8'))
    const privacy = await readFile(new URL('../supabase/migrations/20261018_profile_privacy.sql',import.meta.url),'utf8')
    await db.exec(privacy)
    await db.exec(privacy)
    assert.ok((await db.query('select is_public from public.profiles')).rows.every(r=>r.is_public===false))

    await db.exec("alter table public.profiles add column username text; update public.profiles set username='tester'")
    const sql = await readFile(new URL('../supabase/migrations/20261102_activity_history.sql',import.meta.url),'utf8')
    await db.exec(sql)
    await db.exec(sql)
    const history = async () => {
      await db.exec('reset role')
      return (await db.query('select * from collection_private.activity_history order by id')).rows
    }
    assert.equal((await history()).length,0,'no synthetic historical events')
    await as(1)
    await db.query("insert into public.items(user_id,category,title,note) values($1,'kitap','Activity book','PRIVATE_NOTE')",[id(1)])
    await db.query("update public.items set progress='{" + '"position":10' + "}', note='PRIVATE_EDIT' where title='Activity book'")
    await db.query("update public.items set note='PRIVATE_EDIT' where title='Activity book'")
    let events=await history()
    assert.equal(events.length,2,'unchanged write is ignored')
    assert.equal(events[1].action,'item_progress_updated')
    assert.equal(events[1].details.after.progress.position,10)
    assert.ok(!JSON.stringify(events).includes('PRIVATE_'))
    assert.ok(events[1].details.changed_fields.includes('note'))
    await as(1)
    await db.exec('begin')
    await db.query("update public.items set title='Rolled back' where title='Activity book'")
    await db.exec('rollback')
    assert.equal((await history()).length,2)
    await as(1)
    await db.query('select public.send_friend_request($1)',[id(2)])
    const pending=(await db.query('select id from public.friendships')).rows[0].id
    await as(2)
    await db.query('select public.accept_friend_request($1)',[pending])
    await db.query('select * from public.set_item_reaction(1,1)')
    await db.query('select * from public.set_item_reaction(1,-1)')
    await db.query('select * from public.set_item_reaction(1,null)')
    await db.query('select public.remove_friendship($1)',[pending])
    events=await history()
    assert.deepEqual(events.slice(2).map(e=>e.action),['friend_request_sent','friendship_accepted','reaction_added','reaction_changed','reaction_removed','friendship_removed'])
    assert.equal(events[3].actor_id,id(2))
    assert.equal(events[4].related_user_id,id(1))
    assert.equal(events[5].details.before,1)
    assert.equal(events[5].details.after,-1)
    await as(1)
    await db.query('update public.profiles set is_public=true,bio=$1 where id=$2',['PRIVATE_BIO',id(1)])
    await as(2)
    await db.query('select public.send_friend_request($1)',[id(1)])
    events=await history()
    assert.equal(events.at(-1).action,'friendship_auto_accepted')
    assert.ok(!JSON.stringify(events).includes('PRIVATE_BIO'))
    await as(2)
    await db.query('select public.send_friend_request($1)',[id(3)])
    let requestId=(await db.query('select id from public.friendships where recipient_id=$1',[id(3)])).rows[0].id
    await db.query('select public.remove_friendship($1)',[requestId])
    assert.equal((await history()).at(-1).action,'friend_request_cancelled')
    await as(2)
    await db.query('select public.send_friend_request($1)',[id(3)])
    requestId=(await db.query('select id from public.friendships where recipient_id=$1',[id(3)])).rows[0].id
    await as(3)
    await db.query('select public.remove_friendship($1)',[requestId])
    assert.equal((await history()).at(-1).action,'friend_request_rejected')
    await as(1)
    await db.query("delete from public.items where title='Activity book'")
    assert.equal((await history()).at(-1).action,'item_deleted')
    await as(1)
    for(const q of [
      'select * from collection_private.activity_history',
      'delete from collection_private.activity_history',
      "update collection_private.activity_history set action='fake'",
      "insert into collection_private.activity_history(action,origin) values('fake','fake')",
      'select collection_private.prune_activity_history()',
      'select * from collection_private.activity_presence',
    ]) await assert.rejects(db.query(q),/permission denied/)
    await db.query('select public.record_activity_presence()')
    await db.query('select public.record_activity_presence()')
    events=await history()
    assert.equal(events.filter(e=>e.action==='site_visit').length,1)
    await db.query("update collection_private.activity_presence set last_seen_at=now()-interval '6 minutes',last_logged_at=now()-interval '6 minutes'")
    await as(1)
    await db.query('select public.record_activity_presence()')
    assert.equal((await history()).at(-1).action,'site_active')
    await db.query("update collection_private.activity_presence set last_seen_at=now()-interval '31 minutes'")
    await as(1)
    await db.query('select public.record_activity_presence()')
    assert.equal((await history()).at(-1).action,'site_visit')
    await db.exec("select set_config('request.jwt.claim.sub','',false)")
    await db.query("insert into public.items(user_id,category,title) values($1,'film','Server write')",[id(1)])
    events=await history()
    assert.equal(events.at(-1).actor_id,null)
    assert.equal(events.at(-1).subject_id,id(1))
    assert.equal(events.at(-1).origin,'server_or_admin')
    const itemCount=(await db.query('select count(*) from public.items')).rows[0].count
    await db.query("update collection_private.activity_history set occurred_at=now()-interval '91 days' where action='item_created'")
    await db.query('select collection_private.prune_activity_history()')
    assert.equal((await history()).filter(e=>e.action==='item_created').length,0)
    assert.equal((await db.query('select count(*) from public.items')).rows[0].count,itemCount)
    await db.query("update collection_private.activity_history set occurred_at=now()-interval '91 days' where action='friend_request_sent'")
    await db.query("update collection_private.activity_maintenance set last_run=current_date-1")
    await as(1)
    await db.query("update public.items set rating=7 where title='Server write'")
    assert.equal((await history()).filter(e=>e.action==='friend_request_sent').length,0,'first new event cleans expired history')
    await db.exec(sql)
    await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(db.query('select public.record_activity_presence()'),/permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(db.query('select public.record_activity_presence()'),/giriş yap/)
  } finally { await db.close() }
})
