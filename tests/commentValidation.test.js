import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commentError } from '../src/utils/commentValidation.js'

test('comments require content but do not impose word or character limits', () => {
  assert.equal(commentError(''), 'Yorumunu yaz.')
  assert.equal(commentError('a '.repeat(100)), '')
  assert.equal(commentError('a '.repeat(101)), '')
  assert.equal(commentError('a'.repeat(1000)), '')
  assert.equal(commentError('a'.repeat(10001)), '')
  assert.equal(commentError(' \n\t\u00a0 '), 'Yorumunu yaz.')
  assert.equal(commentError('😀'), '')
})
