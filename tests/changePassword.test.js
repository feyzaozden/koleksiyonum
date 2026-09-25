import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changePasswordWithVerification } from '../src/utils/changePassword.js'

const user = { id: 'test-user', email: 'test@example.com' }
test('incorrect current password cannot update password', async () => {
  let updated = false
  const auth = {
    signInWithPassword: async () => ({ error: { code: 'invalid_credentials' } }),
    updateUser: async () => { updated = true; return { error: null } },
  }
  await assert.rejects(changePasswordWithVerification(auth, user, 'wrong', 'NewPass12'), /Mevcut şifren yanlış/)
  assert.equal(updated, false)
})
test('missing current password makes no auth request', async () => {
  await assert.rejects(changePasswordWithVerification({}, user, '', 'NewPass12'), /Mevcut şifreni gir/)
})
test('verified old password need not meet new complexity rules and is not trimmed', async () => {
  const calls = []
  const auth = {
    signInWithPassword: async (input) => { calls.push(input); return { data: { user }, error: null } },
    updateUser: async (input) => { calls.push(input); return { error: null } },
  }
  await changePasswordWithVerification(auth, user, ' old ', 'NewPass12')
  assert.deepEqual(calls, [{ email: user.email, password: ' old ' }, { current_password: ' old ', password: 'NewPass12' }])
})
test('failed password update does not report success', async () => {
  const auth = {
    signInWithPassword: async () => ({ data: { user }, error: null }),
    updateUser: async () => ({ error: new Error('Network error') }),
  }
  await assert.rejects(changePasswordWithVerification(auth, user, 'old', 'NewPass12'), /Network error/)
})
