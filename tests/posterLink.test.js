import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('poster linking preserves records, enforces ownership and prevents duplicates', async () => {
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const stranger = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
      grant usage on schema auth,public to authenticated,anon,service_role;`)
    for (const file of ['schema.sql','migrations/20260925_friendships.sql','migrations/20260929_item_progress.sql','migrations/20261014_item_guardrails.sql','migrations/20261106_item_posters.sql','migrations/20261106_link_item_poster.sql']) await db.exec(await readFile(new URL('../supabase/'+file, import.meta.url),'utf8'))
    await db.query('insert into auth.users(id,email) values($1,$3),($2,$4)',[owner,stranger,'a@test.test','b@test.test'])
    const before = (await db.query("insert into public.items(user_id,category,title,note,rating) values($1,'film','Old title','Keep note',8) returning *",[owner])).rows[0]
    const other = (await db.query("insert into public.items(user_id,category,title) values($1,'film','Other') returning id",[owner])).rows[0].id
    const link = (id, uid, tmdb=42) => db.query("select (public.link_item_poster($1,$2,'film',$3,'/cover.jpg')).*",[id,uid,tmdb])
    await db.exec("set role authenticated; select set_config('request.jwt.claim.role','authenticated',false)")
    await assert.rejects(link(before.id,owner),/permission denied/)
    await db.exec("reset role; set role service_role; select set_config('request.jwt.claim.role','service_role',false)")
    await assert.rejects(link(before.id,stranger),/bulunamadı/)
    const after = (await link(before.id,owner)).rows[0]
    for (const key of ['id','user_id','title','note','rating','added_at','status']) assert.deepEqual(after[key],before[key])
    assert.equal(after.poster_path,'/cover.jpg')
    assert.equal(Number(after.source_id),42)
    await assert.rejects(link(other,owner),/unique|zaten/)
    await assert.rejects(link(before.id,owner,43),/eşleştirilmiş/)
  } finally { await db.close() }
})

