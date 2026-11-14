import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('playlist covers preserve rows and enforce owner paths and private storage access', async () => {
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001', visitor = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.profiles(id uuid primary key,is_public boolean default false);
      create table public.friendships(requester_id uuid,recipient_id uuid,status text);
      create table public.music_playlists(id int primary key,user_id uuid,name text);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id int primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to authenticated;
      grant select on public.profiles,public.friendships to authenticated;
      grant select,insert,delete on storage.objects to authenticated;
      insert into public.profiles(id) values('${owner}'),('${visitor}');
      insert into public.music_playlists values(1,'${owner}','Existing');`)
    const sql = await readFile(new URL('../supabase/migrations/20261114_playlist_covers.sql', import.meta.url), 'utf8')
    await db.exec(sql); await db.exec(sql)
    assert.equal((await db.query('select name from music_playlists')).rows[0].name, 'Existing')
    await assert.rejects(db.query('update music_playlists set cover_path=$1', [`${visitor}/${owner}.jpg`]), /check constraint/)
    const path = `${owner}/${owner}.jpg`
    await db.query('update music_playlists set cover_path=$1', [path])
    const login = async id => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]) }
    await login(owner)
    await db.query("insert into storage.objects values(1,'music-covers',$1)", [path])
    await login(visitor)
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0)
    await assert.rejects(db.query("insert into storage.objects values(2,'music-covers',$1)", [path]), /row-level security/)
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0)
    await db.exec('reset role')
    await db.query("insert into friendships values($1,$2,'accepted')", [owner, visitor])
    await login(visitor)
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1)
    await db.exec('reset role; delete from friendships')
    await db.query('update profiles set is_public=true where id=$1', [owner])
    await login(visitor)
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1)
  } finally { await db.close() }
})
