import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskDate, parseDate, displayDate, validateItemDates, dateInputError, itemYearError } from '../src/utils/itemDates.js'

test('release year rejects future years and follows the current year', () => {
  assert.equal(itemYearError('2026', 2026), '')
  assert.equal(itemYearError('1999', 2026), '')
  assert.equal(itemYearError('', 2026), '')
  assert.equal(itemYearError(null, 2026), '')
  assert.match(itemYearError('2027', 2026), /2026/)
  assert.equal(itemYearError('2027', 2027), '')
  assert.ok(itemYearError('abcd', 2026))
  assert.ok(itemYearError('0000', 2026))
})

test('partial input reports invalid segments immediately without requiring the rest of the date', () => {
  assert.match(dateInputError('78//'), /Gün/)
  assert.match(dateInputError('/13/'), /Ay/)
  assert.match(dateInputError('//0000'), /Yıl/)
  assert.match(dateInputError('31/04/'), /30/)
  assert.match(dateInputError('29/02/2025'), /28/)
  assert.equal(dateInputError('29/02/2024'), '')
  assert.equal(dateInputError('2/09/2026'), '')
  assert.match(dateInputError('28/09/2026', { max: '2026-09-27' }), /bugünden/)
  assert.match(dateInputError('26/09/2026', { min: '2026-09-27' }), /önce/)
})

test('manual dates are masked and converted without timezone shifts', () => {
  assert.equal(maskDate('27092026'), '27/09/2026')
  assert.equal(maskDate('27/09/2026'), '27/09/2026')
  assert.equal(parseDate('27/09/2026'), '2026-09-27')
  assert.equal(displayDate('2026-09-27'), '27/09/2026')
  assert.equal(parseDate(''), null)
})

test('invalid day, month, year and incomplete dates are rejected including leap years', () => {
  for (const value of ['78/09/2026', '10/13/2026', '00/01/2026', '01/00/2026', '01/01/0000', '31/04/2026', '29/02/2025', '29/02/1900', '27/09/20']) assert.throws(() => parseDate(value), undefined, value)
  assert.equal(parseDate('29/02/2024'), '2024-02-29')
  assert.equal(parseDate('29/02/2000'), '2000-02-29')
})

test('start cannot be future; end cannot precede start; same-day and optional dates work', () => {
  const today = '2026-09-27'
  assert.throws(() => validateItemDates({ start_date: '2026-09-28' }, today), /bugünden/)
  assert.throws(() => validateItemDates({ end_date: '2026-09-28' }, today), /Bitiş tarihi bugünden/)
  assert.throws(() => validateItemDates({ start_date: '2026-09-01', end_date: '2026-09-28' }, today), /Bitiş tarihi bugünden/)
  assert.equal(dateInputError('28/09/2026', { min: '2026-09-01', max: today }), 'Tarih bugünden sonra olamaz.')
  assert.equal(dateInputError('27/09/2026', { min: today, max: today }), '')
  validateItemDates({ end_date: today }, today)
  assert.equal(dateInputError('15/09/2026', { min: '2026-09-01', max: today }), '')
  validateItemDates({ start_date: '2026-09-01', end_date: '2026-09-15' }, today)
  assert.throws(() => validateItemDates({ start_date: today, end_date: '2026-09-26' }, today), /önce/)
  validateItemDates({ start_date: today, end_date: today }, today)
  validateItemDates({ start_date: '2020-01-01' }, today)
  validateItemDates({ end_date: '2020-01-01' }, today)
  validateItemDates({}, today)
})
