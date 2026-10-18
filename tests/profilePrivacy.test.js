import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('public profiles enforce directional friendship and authenticated visibility', async () => {
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
    const owners = async () => {
      return (await db.query('select user_id from public.items order by user_id')).rows.map((r) => r.user_id)
    }

    await db.exec(await readFile(new URL('../supabase/migrations/20261013_item_reactions.sql',import.meta.url),'utf8'))
    const privacy = await readFile(new URL('../supabase/migrations/20261018_profile_privacy.sql',import.meta.url),'utf8')
    await db.exec(privacy)
    await db.exec(privacy)
    assert.ok((await db.query('select is_public from public.profiles')).rows.every(r=>r.is_public===false))
    await as(1)
    assert.deepEqual(await owners(),[id(1)])
    await db.query('update public.profiles set is_public=true where id=$1',[id(1)])
    await as(2)
    assert.deepEqual(await owners(),[id(1),id(2)])
    assert.equal((await db.query('select * from public.get_item_reactions(array[1::bigint])')).rows.length,1)
    await assert.rejects(db.query('select * from public.set_item_reaction(1,1)'))
    assert.equal((await db.query('update public.profiles set is_public=true where id=$1 returning id',[id(3)])).rows.length,0)
    assert.equal((await db.query('update public.items set title=$1 where user_id=$2 returning id',['forged',id(1)])).rows.length,0)
    assert.equal((await db.query('delete from public.items where user_id=$1 returning id',[id(1)])).rows.length,0)
    // Private sender -> open recipient immediately accepted.
    await db.query('select public.send_friend_request($1)',[id(1)])
    await db.query('select public.send_friend_request($1)',[id(1)])
    let rows=(await db.query('select * from public.friendships')).rows
    assert.equal(rows.length,1)
    assert.equal(rows[0].status,'accepted')
    const accepted=rows[0].id
    await as(1)
    assert.deepEqual(await owners(),[id(1),id(2)])
    // Open sender -> private recipient remains pending.
    await db.query('select public.send_friend_request($1)',[id(3)])
    rows=(await db.query('select * from public.friendships where recipient_id=$1',[id(3)])).rows
    assert.equal(rows[0].status,'pending')
    assert.deepEqual(await owners(),[id(1),id(2)])
    // Going private preserves existing friends, revokes strangers.
    await db.query('update public.profiles set is_public=false where id=$1',[id(1)])
    await as(3)
    assert.deepEqual(await owners(),[id(3)])
    assert.equal((await db.query('select * from public.get_item_reactions(array[1::bigint])')).rows.length,0)
    await as(2)
    assert.deepEqual(await owners(),[id(1),id(2)])
    await db.query('select public.remove_friendship($1)',[accepted])
    assert.deepEqual(await owners(),[id(2)])
    // Opening an account does not silently accept old requests.
    await as(3)
    await db.query('update public.profiles set is_public=true where id=$1',[id(3)])
    assert.equal((await db.query('select status from public.friendships')).rows[0].status,'pending')
    await as(1)
    await db.query('select public.send_friend_request($1)',[id(3)])
    assert.equal((await db.query('select status from public.friendships')).rows[0].status,'accepted')
    await db.exec('reset role')
    await db.exec(privacy)
    assert.equal((await db.query('select is_public from public.profiles where id=$1',[id(3)])).rows[0].is_public,true)
    await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)")
    assert.deepEqual(await owners(),[])
    await assert.rejects(db.query('select * from public.get_item_reactions(array[3::bigint])'))
    await assert.rejects(db.query('select public.send_friend_request($1)',[id(3)]))
  } finally { await db.close() }
})
