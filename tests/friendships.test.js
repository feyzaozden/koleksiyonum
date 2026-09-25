import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('friend requests and collection access are enforced by PostgreSQL', async () => {
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
    await as(1)
    assert.deepEqual(await owners(), [id(1)], 'strangers cannot read collections')
    assert.equal((await db.query('select * from public.profiles')).rows.length, 3, 'basic profiles are discoverable')
    await assert.rejects(db.query('select public.send_friend_request($1)', [id(1)]), /Geçersiz/)
    await db.query('select public.send_friend_request($1)', [id(2)])
    await db.query('select public.send_friend_request($1)', [id(2)])
    const requests = (await db.query('select * from public.friendships')).rows
    assert.equal(requests.length, 1, 'duplicate request is idempotent')
    const requestId = requests[0].id
    assert.deepEqual(await owners(), [id(1)], 'pending request grants no access')
    await assert.rejects(db.query('select public.accept_friend_request($1)', [requestId]), /yetkin/)
    await assert.rejects(db.query("update public.friendships set status = 'accepted'"), /permission denied/)
    await assert.rejects(db.query("insert into public.friendships(requester_id, recipient_id, status) values ($1, $2, 'accepted')", [id(1), id(3)]), /permission denied/)
    await as(3)
    assert.equal((await db.query('select * from public.friendships')).rows.length, 0)
    await assert.rejects(db.query('select public.accept_friend_request($1)', [requestId]), /yetkin/)
    await assert.rejects(db.query('select public.remove_friendship($1)', [requestId]), /mevcut/)
    await as(2)
    await db.query('select public.send_friend_request($1)', [id(1)])
    assert.equal((await db.query('select * from public.friendships')).rows.length, 1, 'opposite request cannot create another pair')
    assert.deepEqual(await owners(), [id(2)], 'opposite request does not silently accept')
    await db.query('select public.accept_friend_request($1)', [requestId])
    assert.deepEqual(await owners(), [id(1), id(2)], 'recipient can see sender after acceptance')
    await as(1)
    assert.deepEqual(await owners(), [id(1), id(2)], 'sender can see recipient after acceptance')
    const average = (await db.query('select avg(rating)::float as rating from public.items')).rows[0].rating
    assert.equal(average, 7, 'IMDb aggregate excludes stranger rating')
    await as(2)
    await db.query('select public.send_friend_request($1)', [id(3)])
    const thirdRequest = (await db.query('select id from public.friendships where recipient_id = $1', [id(3)])).rows[0].id
    await as(3)
    await db.query('select public.accept_friend_request($1)', [thirdRequest])
    assert.deepEqual(await owners(), [id(2), id(3)], 'third user sees own friend only')
    await as(1)
    assert.deepEqual(await owners(), [id(1), id(2)], 'friends of friends remain private')
    await as(3)
    await db.query('select public.remove_friendship($1)', [thirdRequest])
    await as(1)
    assert.equal((await db.query('update public.items set rating = 10 where user_id = $1 returning id', [id(2)])).rows.length, 0, 'friend cannot edit collection')
    assert.equal((await db.query('delete from public.items where user_id = $1 returning id', [id(2)])).rows.length, 0, 'friend cannot delete collection')
    await assert.rejects(db.query('update public.items set user_id = $1 where user_id = $2', [id(2), id(1)]), /row-level security/)
    await db.query('select public.remove_friendship($1)', [requestId])
    assert.deepEqual(await owners(), [id(1)], 'removal revokes sender access')
    await as(2)
    assert.deepEqual(await owners(), [id(2)], 'removal revokes recipient access')
    for (const actor of [1, 2]) {
      await as(1)
      await db.query('select public.send_friend_request($1)', [id(2)])
      const row = (await db.query('select id from public.friendships')).rows[0]
      await as(actor)
      await db.query('select public.remove_friendship($1)', [row.id])
      assert.equal((await db.query('select * from public.friendships')).rows.length, 0, 'cancel/reject removes pending request')
    }
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(db.query('select public.send_friend_request($1)', [id(1)]), /permission denied/)
  } finally { await db.close() }
})
