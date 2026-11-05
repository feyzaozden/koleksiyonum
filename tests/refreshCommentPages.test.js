import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refreshCommentPages } from '../src/utils/refreshCommentPages.js'

test('new comment refresh retains earlier pages and a contiguous next cursor', async () => {
  const calls = []
  const pages = {
    0: { entries: [{ id: 1 }, { id: 2 }], next_after: 2, has_more: true },
    2: { entries: [{ id: 3 }, { id: 4 }], next_after: 4, has_more: true },
    4: { entries: [{ id: 5 }], next_after: 5, has_more: false },
  }
  const result = await refreshCommentPages(async cursor => { calls.push(cursor); return { data: pages[cursor] } }, 2, 5)
  assert.deepEqual(result.data.entries.map(e => e.id), [1,2,3,4,5])
  assert.deepEqual(calls, [0,2,4])
  assert.equal(result.data.has_more, false)
})

test('late reply refresh retains all previously loaded threads, without loading unnecessary pages', async () => {
  const result = await refreshCommentPages(async cursor => ({ data: cursor === 0
    ? { entries:[{id:1},{id:100,parent_id:1}],next_after:1,has_more:true }
    : { entries:[{id:2}],next_after:2,has_more:true }
  }),2,100)
  assert.deepEqual(result.data.entries.map(e=>e.id),[1,100,2])
  assert.equal(result.data.next_after,2)
  assert.equal(result.data.has_more,true)
})
