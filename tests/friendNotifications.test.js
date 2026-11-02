import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('public account friend notifications are private and idempotent', async () => {
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
    await db.exec(await readFile(new URL('../supabase/migrations/20261018_reaction_notifications.sql',import.meta.url),'utf8'))
    const sql=await readFile(new URL('../supabase/migrations/20261102_friend_notifications.sql',import.meta.url),'utf8')
    await db.exec(sql)
    await db.exec(sql)
    const inbox=async()=> (await db.query('select public.get_reaction_notifications() as data')).rows[0].data
    await as(1)
    await db.query('update public.profiles set is_public=true where id=$1',[id(1)])
    await as(2)
    await db.query('select public.send_friend_request($1)',[id(1)])
    await db.query('select public.send_friend_request($1)',[id(1)])
    assert.equal((await inbox()).entries.length,0)
    await as(1)
    let data=await inbox()
    assert.equal(data.entries.length,1)
    assert.equal(data.entries[0].kind,'friend')
    assert.equal(data.entries[0].profile_id,id(2))
    assert.equal(data.entries[0].username,'tester')
    const notice=data.entries[0].id
    await as(3)
    await db.query('select public.read_reaction_notification($1)',[notice])
    assert.equal((await inbox()).entries.length,0)
    await as(1)
    assert.equal((await inbox()).unread,1)
    await db.query('select public.read_reaction_notification($1)',[notice])
    const relation=(await db.query('select id from public.friendships')).rows[0].id
    await db.query('select public.remove_friendship($1)',[relation])
    await as(2)
    await db.query('select public.send_friend_request($1)',[id(1)])
    await db.query('select * from public.set_item_reaction(1,1)')
    await as(1)
    data=await inbox()
    assert.equal(data.entries.length,2)
    assert.equal(data.entries.find(n=>n.kind==='reaction').profile_id,null)
    assert.equal(data.entries.find(n=>n.kind==='reaction').username,null)
    assert.equal(data.entries.find(n=>n.kind==='friend').read_at!==null,true)
    await as(2)
    await db.query('select public.send_friend_request($1)',[id(3)])
    await as(3)
    assert.equal((await inbox()).entries.length,0,'private requests use existing approval flow')
    await assert.rejects(db.query('select * from collection_private.reaction_notifications'))
  } finally { await db.close() }
})
