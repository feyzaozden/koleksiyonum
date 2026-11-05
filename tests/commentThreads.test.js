import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderCommentThreads } from '../src/utils/commentThreads.js'

test('late replies follow their root, keep reply order and preserve orphan replies', () => {
  const rows=[{id:1,parent_id:null},{id:2,parent_id:null},{id:8,parent_id:1},{id:9,parent_id:1},{id:10,parent_id:2},{id:11,parent_id:3}]
  assert.deepEqual(orderCommentThreads(rows).map(r=>r.id),[1,8,9,2,10,11])
  assert.deepEqual(rows.map(r=>r.id),[1,2,8,9,10,11])
})
