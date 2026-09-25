import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { normalizeUsername, validateUsername, usernameSearch } from '../src/utils/username.js'

test('handles normalize capitals, allow dot/underscore, reject spaces and invalid starts', () => {
  assert.equal(normalizeUsername('Feyza.OZDEN_1'), 'feyza.ozden_1')
  for (const value of ['Feyza', 'a.b', 'a_b', 'a12', 'a'.repeat(30)]) assert.equal(validateUsername(value), null)
  for (const value of ['', 'ab', '1feyza', '_feyza', '.feyza', 'fey za', ' feyza', 'feyza ', 'a'.repeat(31), 'feyza!', 'feyza\n', 'şule']) assert.ok(validateUsername(value), value)
  assert.equal(usernameSearch(' @FEYZA_1 '), 'feyza_1')
})

for (const oldMigrationApplied of [false, true]) {
  test(`profile migration preserves existing data (previous migration: ${oldMigrationApplied})`, async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        create role authenticated; create role anon;
        create schema auth;
        create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema public, auth to authenticated, anon;
      `)
      await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../supabase/migrations/20260925_friendships.sql', import.meta.url), 'utf8'))
      const a = '00000000-0000-0000-0000-000000000001'
      const b = '00000000-0000-0000-0000-000000000002'
      await db.query(`insert into auth.users(id, email, raw_user_meta_data) values
        ($1, 'a@example.test', '{"display_name":"Feyza Özden"}'),
        ($2, 'b@example.test', '{"display_name":"Other Person"}')`, [a, b])
      await db.query("insert into public.items(user_id, category, title, rating) values ($1, 'kitap', 'Preserved book', 8)", [a])
      await db.query("insert into public.friendships(requester_id, recipient_id, status) values ($1, $2, 'accepted')", [a, b])
      if (oldMigrationApplied) await db.exec(await readFile(new URL('../supabase/migrations/20260926_unique_usernames.sql', import.meta.url), 'utf8'))
      else await db.query('update public.profiles set display_name = $1 where id = $2', ['Feyza Özden', b])
      const beforeNames = (await db.query('select id, display_name from public.profiles order by id')).rows
      const migration = await readFile(new URL('../supabase/migrations/20260927_profile_usernames.sql', import.meta.url), 'utf8')
      await db.exec(migration)
      const after = (await db.query('select id, display_name, username from public.profiles order by id')).rows
      assert.deepEqual(after.map(({ id, display_name }) => ({ id, display_name })), beforeNames)
      assert.equal(new Set(after.map((row) => row.username)).size, 2)
      assert.ok(after.every((row) => !validateUsername(row.username)))
      await db.exec(migration)
      assert.deepEqual((await db.query('select id, display_name, username from public.profiles order by id')).rows, after)
      assert.equal((await db.query('select title from public.items')).rows[0].title, 'Preserved book')
      assert.equal((await db.query('select status from public.friendships')).rows[0].status, 'accepted')
      // Same full name allowed, while handles are required and unique.
      await db.query("update public.profiles set display_name = 'Feyza Özden', username = 'Feyza.Ozden' where id = $1", [a])
      assert.equal((await db.query('select username from public.profiles where id = $1', [a])).rows[0].username, 'feyza.ozden')
      await db.query("update public.profiles set display_name = 'Feyza Özden' where id = $1", [b])
      await assert.rejects(db.query("update public.profiles set username = 'FEYZA.OZDEN' where id = $1", [b]), /unique/)
      for (const invalid of ['with space', ' name', '1name', '_name', '', null]) {
        await assert.rejects(db.query('update public.profiles set username = $1 where id = $2', [invalid, b]), /constraint|null/)
      }
      // New signup preserves full name but normalizes its explicitly chosen handle.
      const c = '00000000-0000-0000-0000-000000000003'
      await db.query(`insert into auth.users(id, email, raw_user_meta_data) values ($1, 'c@example.test', '{"display_name":"Feyza Özden", "username":"New.User_1"}')`, [c])
      assert.equal((await db.query('select username from public.profiles where id = $1', [c])).rows[0].username, 'new.user_1')
      await assert.rejects(db.exec(`insert into auth.users(id, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000004', '{"username":"NEW.USER_1"}')`), /unique/)
      assert.equal((await db.query("select count(*)::int as count from auth.users where id = '00000000-0000-0000-0000-000000000004'")).rows[0].count, 0)
      // Admin-created accounts without metadata get a valid handle as well.
      await db.exec("insert into auth.users(id) values ('00000000-0000-0000-0000-000000000005')")
      assert.equal(validateUsername((await db.query("select username from public.profiles where id = '00000000-0000-0000-0000-000000000005'")).rows[0].username), null)
      await db.exec('set role anon')
      assert.equal((await db.query("select public.is_username_available('NEW.USER_1') as available")).rows[0].available, false)
      assert.equal((await db.query("select public.is_username_available('fresh_user') as available")).rows[0].available, true)
      assert.equal((await db.query("select public.is_username_available('with space') as available")).rows[0].available, false)
      await assert.rejects(db.query('select * from public.profiles'), /permission denied/)
    } finally { await db.close() }
  })
}
