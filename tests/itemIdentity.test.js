import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeItemTitle } from '../src/utils/itemIdentity.js'

test('title hints normalize Turkish case, Unicode and whitespace without conflating punctuation', () => {
  assert.equal(normalizeItemTitle('  İNCİ   kitabı '), 'inci kitabi')
  assert.equal(normalizeItemTitle('ＡＢＣ'), 'abc')
  assert.notEqual(normalizeItemTitle('Book 1'), normalizeItemTitle('Book 2'))
})
