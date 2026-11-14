import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('featured items preserve data, enforce owner and six item limit, retain profile privacy', async () => {
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const stranger = '00000000-0000-0000-0000-000000000002'
  const migration = await readFile(new URL('../supabase/migrations/20261114_profile_featured.sql', import.meta.url), 'utf8')
  try {
    await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
      grant usage on schema auth,public to authenticated,anon,service_role;`)
    for (const file of ['schema.sql','migrations/20260925_friendships.sql','migrations/20260929_item_progress.sql','migrations/20261013_item_reactions.sql','migrations/20261014_item_guardrails.sql','migrations/20261018_profile_privacy.sql']) await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'))
    await db.exec(migration)
    await db.exec('grant select on public.items,public.profiles to authenticated;')
    for (const id of [owner,stranger]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.test'])
    const ids=[]
    for (let i=0;i<7;i++) ids.push((await db.query("insert into public.items(user_id,category,title,note,rating) values($1,'kitap',$2,'Keep note',8) returning id",[owner,'Book '+i])).rows[0].id)
    const login = async id => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]) }
    const pin = (id, value=true) => db.query('select public.set_item_featured($1,$2)',[id,value])
    await login(owner)
    await assert.rejects(db.query('update public.items set featured_at=now() where id=$1',[ids[0]]),/permission denied/)
    for (const id of ids.slice(0,6)) await pin(id)
    await pin(ids[0])
    await assert.rejects(pin(ids[6]),/En fazla 6/)
    await pin(ids[0],false); await pin(ids[6])
    const saved=(await db.query('select * from public.items where id=$1',[ids[6]])).rows[0]
    assert.equal(saved.note,'Keep note'); assert.equal(saved.rating,8)
    await login(stranger)
    await assert.rejects(pin(ids[0]),/sana ait değil/)
    assert.equal((await db.query('select * from public.items where featured_at is not null')).rows.length,0)
    await db.exec('reset role')
    await db.query("insert into public.friendships(requester_id,recipient_id,status) values($1,$2,'accepted')",[owner,stranger])
    await login(stranger)
    assert.equal((await db.query('select * from public.items where featured_at is not null')).rows.length,6)
    await db.exec('reset role; delete from public.friendships')
    await db.query('update public.profiles set is_public=true where id=$1',[owner])
    await login(stranger)
    assert.equal((await db.query('select * from public.items where featured_at is not null')).rows.length,6)
    await db.exec('reset role'); await db.exec(migration)
    assert.equal((await db.query('select * from public.items')).rows.length,7)
    assert.equal((await db.query('select * from public.items where featured_at is not null')).rows.length,6)
    await db.exec('set role anon')
    await assert.rejects(pin(ids[0]),/permission denied/)
  } finally { await db.close() }
})
