import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('new auth sessions create one login event without tracking refreshes', async () => {
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

    await db.exec(await readFile(new URL('../supabase/migrations/20261013_item_reactions.sql',import.meta.url),'utf8'))
    const privacy = await readFile(new URL('../supabase/migrations/20261018_profile_privacy.sql',import.meta.url),'utf8')
    await db.exec(privacy)
    await db.exec(privacy)
    assert.ok((await db.query('select is_public from public.profiles')).rows.every(r=>r.is_public===false))

    await db.exec("alter table public.profiles add column username text; update public.profiles set username='tester'")
    const sql = await readFile(new URL('../supabase/migrations/20261102_activity_history.sql',import.meta.url),'utf8')
    await db.exec(sql)
    await db.exec(sql)

    await db.exec('create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz default now(),updated_at timestamptz default now())')
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(101),id(1)])
    const authMigration=await readFile(new URL('../supabase/migrations/20261102_auth_activity.sql',import.meta.url),'utf8')
    await db.exec(authMigration)
    await db.exec(authMigration)
    const events=async()=> (await db.query("select * from collection_private.activity_history where action='auth_login' order by id")).rows
    assert.equal((await events()).length,0,'no invented history for existing sessions')
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(102),id(1)])
    let rows=await events()
    assert.equal(rows.length,1)
    assert.equal(rows[0].actor_id,id(1))
    assert.equal(rows[0].origin,'supabase_auth')
    assert.deepEqual(rows[0].details,{event:'session_created'})
    await db.query('update auth.sessions set updated_at=now() where id=$1',[id(102)])
    assert.equal((await events()).length,1,'refresh does not log another login')
    await db.query('delete from auth.sessions where id=$1',[id(102)])
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(103),id(1)])
    assert.equal((await events()).length,2,'fresh login creates a separate event')
    await db.exec('begin')
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(104),id(1)])
    await db.exec('rollback')
    assert.equal((await events()).length,2,'rolled back session cannot produce successful login')
    await db.exec('set role authenticated')
    await assert.rejects(db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(105),id(1)]),/permission denied/)
    await assert.rejects(db.query('select * from collection_private.activity_history'),/permission denied/)
  } finally { await db.close() }
})
