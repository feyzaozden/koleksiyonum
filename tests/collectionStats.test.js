import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCompletionStats, getMonthlyCompletionStats } from '../src/utils/collectionStats.js'

test('overall completion stats include all categories and round the percentage', () => {
  const items = [
    { category: 'kitap', status: 'bitti' },
    { category: 'film', status: 'bitti' },
    { category: 'dizi', status: 'devam' },
  ]
  assert.deepEqual(getCompletionStats(items), { total: 3, completed: 2, percentage: 67 })
})

test('empty collections have no completion percentage', () => {
  assert.deepEqual(getCompletionStats([]), { total: 0, completed: 0, percentage: null })
})

test('monthly activity separates started items from completed items and keeps their dates distinct', () => {
  const items = [
    { id: 1, category: 'kitap', status: 'bitti', start_date: '2026-11-01', end_date: '2026-11-09', rating: 8 },
    { id: 2, category: 'film', status: 'bitti', start_date: null, end_date: '2026-11-30' },
    { id: 3, category: 'film', status: 'devam', start_date: '2026-11-09', end_date: null },
    { id: 4, category: 'dizi', status: 'bitti', start_date: null, end_date: null },
    { id: 5, category: 'dizi', status: 'bitti', start_date: '2026-10-31', end_date: '2026-10-31' },
    { id: 6, category: 'other', status: 'bitti', start_date: '2026-11-09', end_date: '2026-11-09' },
  ]
  const result = getMonthlyCompletionStats(items, '2026-11')
  assert.deepEqual(result, {
    month: '2026-11',
    counts: { kitap: 1, film: 1, dizi: 0 },
    started: [items[0], items[2]],
    completed: [items[0], items[1]],
  })
})
