import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { validatePhoto, saveProfilePhoto } from '../src/utils/profilePhoto.js'

test('photo validation rejects oversized, empty and unsupported files', () => {
  for (const file of [{ type: 'image/svg+xml', size: 10 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: 5242881 }]) assert.throws(() => validatePhoto(file))
  validatePhoto({ type: 'image/webp', size: 5242880 })
})

test('photo replacement keeps old photo until profile save succeeds and rolls back failed save', async () => {
  for (const fail of [false, true]) {
    const calls = []
    const storage = { from: () => ({
      upload: async (path) => { calls.push(['upload', path]); return {} },
      remove: async ([path]) => { calls.push(['remove', path]); return {} },
    }) }
    const updateProfile = async (patch) => { calls.push(['save', patch.avatar_path]); if (fail) throw new Error('save failed') }
    const task = saveProfilePhoto({ storage, updateProfile, userId: 'owner', oldPath: 'owner/old.jpg', file: { type: 'image/jpeg', size: 100 } })
    if (fail) await assert.rejects(task, /save failed/)
    else await task
    assert.deepEqual(calls.map(([action]) => action), ['upload', 'save', 'remove'])
    assert.equal(calls[2][1], fail ? calls[0][1] : 'owner/old.jpg')
  }
})

test('photo SQL preserves profiles, is repeatable and restricts storage writes to the owner', async () => {
  const db = new PGlite()
  const a = '00000000-0000-0000-0000-000000000001'
  const b = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function storage.foldername(text) returns text[] language sql immutable as
        $$ select string_to_array($1, '/') $$;
      create table public.profiles(id uuid primary key, display_name text);
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage, auth to authenticated, anon;
      grant select, insert, update, delete on storage.objects to authenticated, anon;
      insert into public.profiles values ('${a}', 'Existing name');
    `)
    const migration = await readFile(new URL('../supabase/migrations/20260928_profile_photos.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration)
    assert.equal((await db.query('select display_name from profiles')).rows[0].display_name, 'Existing name')
    await assert.rejects(db.query('update profiles set avatar_path = $1', [`${b}/abc.jpg`]), /constraint/)
    await db.query('update profiles set avatar_path = $1', [`${a}/abc.jpg`])
    await db.exec(`insert into storage.objects values ('profile-photos', '${b}/abc.jpg'); set role authenticated; set request.jwt.claim.sub = '${a}';`)
    await db.query("insert into storage.objects values ('profile-photos', $1)", [`${a}/abc.jpg`])
    await assert.rejects(db.query("insert into storage.objects values ('profile-photos', $1)", [`${b}/def.jpg`]), /row-level security/)
    await assert.rejects(db.query("insert into storage.objects values ('other-bucket', $1)", [`${a}/abc.jpg`]), /row-level security/)
    assert.equal((await db.query('select * from storage.objects')).rows.length, 2)
    assert.equal((await db.query('delete from storage.objects where name = $1 returning *', [`${b}/abc.jpg`])).rows.length, 0)
    assert.equal((await db.query('delete from storage.objects where name = $1 returning *', [`${a}/abc.jpg`])).rows.length, 1)
    await db.exec('reset role; set role anon')
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0)
  } finally { await db.close() }
})
