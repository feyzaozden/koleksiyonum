import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { progressError, progressPatch, progressText } from '../src/utils/progress.js'

test('optional totals, boundaries and season-specific totals', () => {
  assert.equal(progressError({ position: 128 }, 'kitap'), '')
  assert.equal(progressError({ position: 0, total: 120 }, 'film'), '')
  assert.ok(progressError({ position: 121, total: 120 }, 'film'))
  assert.ok(progressError({ position: -1 }, 'kitap'))
  assert.ok(progressError({ position: 1.5 }, 'kitap'))
  assert.ok(progressError({ season: 1 }, 'dizi'))
  assert.ok(progressError({ season: 1, position: 0 }, 'dizi'))
  const progress = { season: 2, position: 5, seasons: 4, episodes: { 1: 8, 2: 10 } }
  assert.equal(progressError(progress, 'dizi'), '')
  assert.ok(progressError({ ...progress, position: 11 }, 'dizi'))
  assert.ok(progressError({ ...progress, seasons: 1 }, 'dizi'))
  assert.equal(progressText({ category: 'dizi', progress }), 'Sezon 2/4 · Bölüm 5/10 · Bu bölümdeyim')
  assert.deepEqual(progressPatch({ category: 'kitap', status: 'bekliyor' }, { total: 320 }), { progress: { total: 320 } })
  assert.deepEqual(progressPatch({ category: 'kitap', status: 'bekliyor' }, { position: 128 }), { progress: { position: 128 }, status: 'devam' })
})

test('progress migration preserves records and enforces boundaries in PostgreSQL', async () => {
  const db = new PGlite()
  try {
    await db.exec("create table public.items(id int primary key, category text, title text); insert into items values (1, 'dizi', 'Existing series');")
    const sql = await readFile(new URL('../supabase/migrations/20260929_item_progress.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    assert.deepEqual((await db.query('select title, progress from items')).rows[0], { title: 'Existing series', progress: {} })
    const progress = { season: 2, position: 5, seasons: 4, episodes: { 1: 8, 2: 10 } }
    await db.query('update items set progress=$1', [JSON.stringify(progress)])
    for (const bad of [{ ...progress, position: 11 }, { ...progress, seasons: 1 }, { position: 3 }, { season: 1, position: 1, episodes: { 1: -5 } }, { position: '5' }, []]) {
      await assert.rejects(db.query('update items set progress=$1', [JSON.stringify(bad)]), /constraint/)
    }
    assert.deepEqual((await db.query('select progress from items')).rows[0].progress, progress)
    await db.exec("insert into items values (2, 'kitap', 'Book', '{}')")
    await assert.rejects(db.exec(`update items set progress='{"position":321,"total":320}' where id=2`), /constraint/)
  } finally { await db.close() }
})
