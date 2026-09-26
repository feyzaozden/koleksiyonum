import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterAndSortItems } from '../src/utils/filterSort.js'

const options = { category: 'film', statusFilter: 'tumu', search: '', sort: 'newest' }
const item = (id, added_at, dates = {}) => ({ id, title: id, category: 'film', status: 'bitti', added_at, ...dates })

test('viewing dates take priority over addition dates; undated entries come last', () => {
  const items = [
    item('undated-old', '2026-09-01'),
    item('watched-old', '2026-09-27', { end_date: '2020-01-01' }),
    item('undated-new', '2026-09-28'),
    item('started', '2026-09-24', { start_date: '2026-09-20' }),
    item('finished', '2026-09-23', { start_date: '2019-01-01', end_date: '2026-09-25' }),
  ]
  const original = structuredClone(items)
  assert.deepEqual(filterAndSortItems(items, options).map(i => i.id), ['finished', 'started', 'watched-old', 'undated-new', 'undated-old'])
  assert.deepEqual(filterAndSortItems(items, { ...options, sort: 'oldest' }).map(i => i.id), ['watched-old', 'started', 'finished', 'undated-old', 'undated-new'])
  assert.deepEqual(items, original)
})

test('equal viewing dates fall back to addition order and filters still apply', () => {
  const items = [
    item('older', '2026-09-01', { end_date: '2026-08-01' }),
    item('newer', '2026-09-02', { end_date: '2026-08-01' }),
    item('other-category', '2026-09-03', { category: 'kitap' }),
    item('pending', '2026-09-04', { status: 'bekliyor' }),
  ]
  assert.deepEqual(filterAndSortItems(items, { ...options, statusFilter: 'bitti' }).map(i => i.id), ['newer', 'older'])
  assert.deepEqual(filterAndSortItems(items, { ...options, search: 'older' }).map(i => i.id), ['older'])
})
