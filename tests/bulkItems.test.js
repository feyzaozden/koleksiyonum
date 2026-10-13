import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBulkItems } from '../src/utils/bulkItems.js'
import { normalizeItemTitle } from '../src/utils/itemIdentity.js'

test('bulk input preserves categories, handles optional fields and caps batch size', () => {
  const rows = parseBulkItems(' Book A | Author | 2001\r\n\nBook B ', 'kitap')
  assert.equal(rows.length,2)
  assert.equal(rows[0].title,'Book A')
  assert.equal(rows[0].year,'2001')
  assert.equal(rows[1].creator,null)
  assert.equal(rows[1].category,'kitap')
  assert.throws(()=>parseBulkItems('','kitap'),/En az/)
  assert.throws(()=>parseBulkItems(Array(101).fill('Book').join('\n'),'kitap'),/100/)
  assert.throws(()=>parseBulkItems('A|B|C|D','film'),/satır/)
})
test('title hints normalize Turkish case, Unicode and whitespace without conflating punctuation',()=>{
  assert.equal(normalizeItemTitle('  İNCİ   kitabı '),'inci kitabi')
  assert.equal(normalizeItemTitle('ＡＢＣ'),'abc')
  assert.notEqual(normalizeItemTitle('Book 1'),normalizeItemTitle('Book 2'))
})
