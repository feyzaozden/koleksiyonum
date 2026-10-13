import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('reactions are anonymous to clients, limited to friends and one vote per item/user', async () => {
  const db = new PGlite()
  const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const as = async (n) => {
    await db.exec('reset role; set role authenticated;')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id(n)])
  }
  const vote = (value, item = 1) => db.query('select * from public.set_item_reaction($1, $2)', [item, value])
  const counts = async () => (await db.query('select * from public.get_item_reactions(array[1::bigint,2::bigint,999::bigint])')).rows
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

    await as(4)
    assert.deepEqual((await counts()).map((row) => Number(row.item_id)), [2], 'pending friendship cannot read totals of another collection')
    await assert.rejects(vote(1), /erişilemiyor/)
    await as(1)
    await assert.rejects(vote(1), /Kendi/)
    assert.equal(Number((await counts())[0].likes), 0)

    await as(2)
    await assert.rejects(vote(0), /Geçersiz/)
    await assert.rejects(vote(1, 999), /erişilemiyor/)
    await assert.rejects(vote(1, 2), /erişilemiyor/)
    await vote(1)
    let result = (await vote(1)).rows[0]
    assert.equal(Number(result.likes), 1, 'retry cannot double count')
    assert.equal(result.my_reaction, 1)
    result = (await vote(-1)).rows[0]
    assert.equal(Number(result.likes), 0)
    assert.equal(Number(result.dislikes), 1, 'switching moves the single vote')
    await as(3)
    await vote(1)
    await as(1)
    const ownerView = (await counts())[0]
    assert.deepEqual(Object.keys(ownerView).sort(), ['dislikes', 'item_id', 'likes', 'my_reaction'])
    assert.equal(ownerView.my_reaction, null)
    assert.equal(Number(ownerView.likes), 1)
    assert.equal(Number(ownerView.dislikes), 1)

    for (const actor of [1, 2, 3, 4]) {
      await as(actor)
      await assert.rejects(db.query('select * from public.item_reactions'), /permission denied/)
      await assert.rejects(db.query('select count(*) from public.item_reactions'), /permission denied/)
      await assert.rejects(db.query('insert into public.item_reactions values (1,$1,1)', [id(4)]), /permission denied/)
      await assert.rejects(db.query('delete from public.item_reactions'), /permission denied/)
      await assert.rejects(db.query('update public.item_reactions set reaction = 1'), /permission denied/)
    }

    await as(2)
    result = (await vote(null)).rows[0]
    assert.equal(Number(result.dislikes), 0)
    assert.equal(result.my_reaction, null)
    await vote(-1)

    await db.exec('reset role')
    await db.exec(migration)
    assert.equal((await db.query('select * from public.items')).rows.length, 2, 'migration preserves collections')
    assert.equal((await db.query('select * from public.item_reactions')).rows.length, 2, 'rerun preserves existing votes')

    await as(1)
    const friendship = (await db.query('select id from public.friendships where recipient_id = $1', [id(2)])).rows[0].id
    await db.query('select public.remove_friendship($1)', [friendship])
    await as(2)
    assert.equal((await counts()).length, 0, 'unfriending revokes totals access')
    await assert.rejects(vote(1), /erişilemiyor/)
    await assert.rejects(vote(null), /erişilemiyor/)
    await as(1)
    assert.equal(Number((await counts())[0].dislikes), 1, 'existing votes remain without exposing past voters')
    await db.query('delete from public.items where id=1')
    await db.exec('reset role')
    assert.equal((await db.query('select * from public.item_reactions')).rows.length, 0, 'item deletion cascades reactions')

    await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(counts(), /permission denied/)
    await assert.rejects(vote(1), /permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(counts(), /giriş yap/)
    await assert.rejects(vote(1), /giriş yap/)
  } finally { await db.close() }
})
