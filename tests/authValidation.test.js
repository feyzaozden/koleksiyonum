import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateEmail, validateNewPassword } from '../src/utils/authValidation.js'

test('email accepts aliases and subdomains without restricting providers', () => {
  for (const value of ['  Ada+kitap@example.com  ', 'ada.soyad@posta.example.com', "o'connor@example.travel"]) {
    assert.equal(validateEmail(value), null)
  }
})
test('email rejects malformed public addresses', () => {
  for (const value of ['', 'ada', 'ada@@example.com', 'ada @example.com', '.ada@example.com', 'ada..soyad@example.com', 'ada@example', 'ada@-example.com', 'ada@example..com', 'a'.repeat(65) + '@example.com']) {
    assert.ok(validateEmail(value), value)
  }
})
test('new password requires length, ASCII upper/lowercase and digit', () => {
  for (const value of ['Abcde12', 'abcdefghijkl1', 'ABCDEFGHIJKL1', 'Abcdefghijkl']) assert.ok(validateNewPassword(value))
  assert.equal(validateNewPassword('Abcdef12'), null)
  assert.equal(validateNewPassword('Uzun bir parola 42!'), null)
  assert.equal(validateNewPassword('İı'.repeat(6)), 'Şifre gereksinimleri: En az bir büyük harf (A–Z), En az bir küçük harf (a–z), En az bir rakam (0–9).')
})
