import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('item limits, identity protection, bulk outcomes and moderation are enforced in PostgreSQL', async () => {
  const db = new PGlite()
  const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const as = async (n) => {
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)])
  }
  const insert = (n,title,extra = {}) => db.query(`insert into public.items(user_id,category,title,creator,year,note)
    values($1,$2,$3,$4,$5,$6) returning *`, [id(n),extra.category || 'kitap',title,extra.creator ?? null,extra.year ?? null,extra.note ?? null])
  const usage = async () => (await db.query('select public.get_item_creation_status() as status')).rows[0].status
  try {
    await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;`)
    for (const path of ['schema.sql','migrations/20260925_friendships.sql','migrations/20260929_item_progress.sql']) {
      await db.exec(await readFile(new URL(`../supabase/${path}`,import.meta.url),'utf8'))
    }
    await db.exec('grant select,insert,update,delete on public.items to authenticated; grant usage,select on all sequences in schema public to authenticated;')
    for (let n=1;n<=5;n++) await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`test${n}@example.test`])
    await insert(1,'Legacy duplicate')
    await insert(1,'Legacy duplicate')
    await insert(1,'Old invalid fields',{note:'x'.repeat(4000), year:'2099'})
    const migration = await readFile(new URL('../supabase/migrations/20261014_item_guardrails.sql',import.meta.url),'utf8')
    await db.exec(migration)
    await db.exec(migration)
    assert.equal((await db.query('select * from public.items')).rows.length,3)
    await as(1)
    assert.equal((await usage()).used,3)
    await db.query("update public.items set status='devam' where title='Old invalid fields'")
    await assert.rejects(insert(1,'  LEGACY   DUPLICATE '),/zaten/)
    await assert.rejects(insert(1,' \t '),/Başlık/)
    await assert.rejects(insert(1,'x'.repeat(301)),/Başlık/)
    await assert.rejects(insert(1,'Book',{year:'abcd'}),/yıl/)
    await assert.rejects(insert(1,'Book',{year:'9999'}),/Yıl/)
    await assert.rejects(insert(1,'Book',{note:'x'.repeat(3001)}),/Not/)
    await assert.rejects(db.query("insert into public.items(user_id,category,title,start_date,end_date) values($1,'kitap','Dates','2001-01-02','2001-01-01')",[id(1)]),/Bitiş/)
    await assert.rejects(db.query("insert into public.items(user_id,category,title,added_at) values($1,'kitap','Spoof',now()-interval '1 day')",[id(1)]),/permission denied/)
    await assert.rejects(db.query("insert into public.items(user_id,category,title,source,source_id) values($1,'film','Spoof','tmdb',1)",[id(1)]),/permission denied/)
    await assert.rejects(db.query('select * from collection_private.daily_item_usage'),/permission denied/)
    assert.equal((await usage()).used,3,'failed requests do not consume quota')
    await insert(1,'İNCİ',{creator:'Yazar',year:'2000'})
    await assert.rejects(insert(1,'inci',{creator:' YAZAR ',year:'2000'}),/zaten/)
    await insert(1,'inci',{creator:'Different author',year:'2000'})
    await as(2)
    await insert(2,'İNCİ',{creator:'Yazar',year:'2000'})
    await assert.rejects(insert(1,'Wrong account'),/row-level security/)

    // Verified metadata can only be inserted through service_role, not a client JWT.
    await db.exec('reset role; set role service_role')
    const verified = (await db.query("insert into public.items(user_id,category,title,source,source_id) values($1,'film','Interstellar','tmdb',157336) returning id",[id(2)])).rows[0]
    await assert.rejects(db.query("insert into public.items(user_id,category,title,source,source_id) values($1,'film','Yıldızlararası','tmdb',157336)",[id(2)]),/unique/)
    await db.query("insert into public.items(user_id,category,title,source,source_id) values($1,'dizi','Another work','tmdb',157336)",[id(2)])
    await as(2)
    await assert.rejects(db.query('update public.items set source_id=2 where id=$1',[verified.id]),/permission denied/)
    await assert.rejects(db.query("update public.items set category='dizi' where id=$1",[verified.id]),/kategorisi/)
    await assert.rejects(insert(2,'Interstellar',{category:'film'}),/zaten/)

    await as(3)
    const bulk = await db.query('select * from public.import_collection_items($1::jsonb)',[JSON.stringify([
      {category:'kitap',title:'Book A'}, {category:'kitap',title:'  BOOK A  '}, {category:'kitap',title:''},
      {category:'kitap',title:'Book B'}, {category:'film',title:'Fake',source:'tmdb',source_id:1},
    ])])
    assert.deepEqual(bulk.rows.map(r=>r.outcome),['added','duplicate','rejected','added','rejected'])
    assert.equal((await usage()).used,2)
    const many = Array.from({length:100},(_,n)=>({category:'kitap',title:`Bulk ${n}`}))
    const outcome = await db.query('select * from public.import_collection_items($1::jsonb)',[JSON.stringify(many)])
    assert.equal(outcome.rows.filter(r=>r.outcome==='added').length,98)
    assert.equal(outcome.rows.filter(r=>r.outcome==='rejected').length,2)
    assert.equal((await usage()).used,100)
    await db.query('delete from public.items where user_id=$1',[id(3)])
    await assert.rejects(insert(3,'After deleting'),/Günlük 100/)
    assert.equal((await usage()).used,100)
    await db.exec('reset role')
    await db.exec(migration)
    await as(3)
    assert.equal((await usage()).used,100,'migration rerun cannot refund quota')

    await as(4)
    const old = (await insert(4,'Keep editing')).rows[0]
    await db.exec('reset role')
    await db.query('insert into collection_private.item_creation_blocks(user_id) values($1)',[id(4)])
    await as(4)
    assert.equal((await usage()).blocked,true)
    await assert.rejects(insert(4,'Blocked'),/kısıtlandı/)
    await db.query('update public.items set note=$1 where id=$2',['Still editable',old.id])
    assert.equal((await usage()).used,1)

    // Yesterday does not count toward the Istanbul calendar day.
    await db.exec('reset role')
    await db.query("insert into collection_private.daily_item_usage values($1,(clock_timestamp() at time zone 'Europe/Istanbul')::date-1,100)",[id(5)])
    await as(5)
    assert.equal((await usage()).used,0)
    await insert(5,'New day')
    assert.equal((await usage()).used,1)
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(db.query('select public.get_item_creation_status()'),/permission denied/)
    await assert.rejects(db.query("select * from public.import_collection_items('[]'::jsonb)"),/permission denied/)
  } finally { await db.close() }
})
