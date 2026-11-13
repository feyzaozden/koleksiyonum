import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('music playlists enforce privacy, ownership, membership and preserve songs on deletion', async () => {
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const friend = '00000000-0000-0000-0000-000000000002'
  const stranger = '00000000-0000-0000-0000-000000000003'
  const recording = '11111111-1111-4111-8111-111111111111'
  try {
    await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
      grant usage on schema auth,public to authenticated,anon,service_role;`)
    for (const file of ['schema.sql','migrations/20260925_friendships.sql','migrations/20260929_item_progress.sql','migrations/20261013_item_reactions.sql','migrations/20261014_item_guardrails.sql','migrations/20261018_profile_privacy.sql','migrations/20261106_item_posters.sql','migrations/20261106_link_item_poster.sql','migrations/20261113_music.sql']) {
      await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'))
    }
    await db.exec('grant select,delete on public.items to authenticated; grant select on public.profiles to authenticated; grant usage on sequence public.items_id_seq to authenticated;')
    for (const id of [owner, friend, stranger]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.test'])
    await db.query("insert into public.friendships(requester_id,recipient_id,status) values($1,$2,'accepted')", [owner, friend])
    const song = (await db.query("insert into public.items(user_id,category,title,music_recording_id) values($1,'muzik','Song',$2) returning id", [owner, recording])).rows[0].id
    const film = (await db.query("insert into public.items(user_id,category,title) values($1,'film','Film') returning id", [owner])).rows[0].id
    const other = (await db.query("insert into public.items(user_id,category,title) values($1,'muzik','Other') returning id", [friend])).rows[0].id
    const login = async id => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [id]) }
    await login(owner)
    await assert.rejects(db.query("insert into public.items(user_id,category,title,music_recording_id) values($1,'muzik','Forged',$2)", [owner, recording]), /permission denied/)
    const playlist = (await db.query("insert into public.music_playlists(name) values('My playlist') returning id")).rows[0].id
    await db.query('insert into public.music_playlist_items(playlist_id,item_id) values($1,$2)', [playlist, song])
    await assert.rejects(db.query('insert into public.music_playlist_items(playlist_id,item_id) values($1,$2)', [playlist, film]), /row-level security/)
    await assert.rejects(db.query('insert into public.music_playlist_items(playlist_id,item_id) values($1,$2)', [playlist, other]), /row-level security/)
    await assert.rejects(db.query('insert into public.music_playlist_items(playlist_id,item_id) values($1,$2)', [playlist, song]), /unique/)
    await login(friend)
    assert.equal((await db.query('select * from public.music_playlists')).rows.length, 1)
    assert.equal((await db.query('select * from public.music_playlist_items')).rows.length, 1)
    assert.equal((await db.query("update public.music_playlists set name='Hacked' returning id")).rows.length, 0)
    await assert.rejects(db.query('insert into public.music_playlist_items(playlist_id,item_id) values($1,$2)', [playlist, other]), /row-level security/)
    await login(stranger)
    assert.equal((await db.query('select * from public.music_playlists')).rows.length, 0)
    assert.equal((await db.query('select * from public.music_playlist_items')).rows.length, 0)
    await db.exec('reset role')
    await db.query('update public.profiles set is_public=true where id=$1', [owner])
    await login(stranger)
    assert.equal((await db.query('select * from public.music_playlists')).rows.length, 1)
    assert.equal((await db.query('select * from public.music_playlist_items')).rows.length, 1)
    await login(owner)
    await db.query('delete from public.music_playlists where id=$1', [playlist])
    assert.equal((await db.query('select * from public.items where id=$1', [song])).rows.length, 1)
    assert.equal((await db.query('select * from public.music_playlist_items')).rows.length, 0)
    await db.exec('reset role')
    await assert.rejects(db.query("insert into public.items(user_id,category,title,music_recording_id) values($1,'muzik','Different title',$2)", [owner, recording]), /unique/)
    await db.exec(await readFile(new URL('../supabase/migrations/20261113_music.sql', import.meta.url), 'utf8'))
    assert.equal((await db.query('select * from public.items')).rows.length, 3)
    // Reproduce production's legacy genre categories without guessing their media type.
    await db.exec('alter table public.items drop constraint items_category_check')
    const legacy = (await db.query("insert into public.items(user_id,category,title,note) values($1,'Roman','Legacy title','Keep this') returning *", [owner])).rows[0]
    await db.exec(await readFile(new URL('../supabase/migrations/20261113_music.sql', import.meta.url), 'utf8'))
    assert.deepEqual((await db.query('select * from public.items where id=$1', [legacy.id])).rows[0], legacy)
    await assert.rejects(db.query("insert into public.items(user_id,category,title) values($1,'Roman','New invalid category')", [owner]), /items_category_check/)
    await assert.rejects(db.query("update public.items set note='Changed' where id=$1", [legacy.id]), /items_category_check/)
    await db.exec(await readFile(new URL('../supabase/migrations/20261113_music.sql', import.meta.url), 'utf8'))
    assert.equal((await db.query('select * from public.items')).rows.length, 4)
  } finally { await db.close() }
})
