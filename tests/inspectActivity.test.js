import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('activity report selects other users and explains empty results in a single result set', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema collection_private;
      create table public.profiles(id integer primary key,username text);
      create table collection_private.activity_presence(user_id integer,last_seen_at timestamptz);
      create table collection_private.activity_history(id integer,occurred_at timestamptz,actor_id integer,subject_id integer,related_user_id integer,action text,origin text,record_id text,details jsonb);
      insert into public.profiles values(1,'feyza'),(2,'baska.kullanici'),(3,'kayitsiz');
      insert into collection_private.activity_history values
      (1,now(),1,1,null,'auth_login','supabase_auth','1','{}'),
      (2,now(),2,2,null,'item_created','authenticated','2','{}');`)
    const sql = await readFile(new URL('../supabase/inspect_activity.sql',import.meta.url),'utf8')
    const run = name => db.query(sql.replace('KULLANICI_ADI',name))
    assert.equal((await run('feyza')).rows[0].islem,'auth_login')
    const other=(await run(' @BASKA.KULLANICI ')).rows
    assert.equal(other.length,1)
    assert.equal(other[0].aranan_kullanici,'baska.kullanici')
    assert.equal(other[0].islem,'item_created')
    assert.match((await run('kayitsiz')).rows[0].sonuc,/henüz kayıtlı aktivitesi yok/)
    assert.match((await run('yok')).rows[0].sonuc,/Kullanıcı bulunamadı/)
    const overview=await readFile(new URL('../supabase/inspect_last_activity.sql',import.meta.url),'utf8')
    assert.equal((await db.query(overview)).rows.length,3)
  } finally { await db.close() }
})
