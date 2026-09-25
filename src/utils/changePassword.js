import { validateNewPassword } from './authValidation.js'

export async function changePasswordWithVerification(auth, user, currentPassword, password) {
  if (!user?.email) throw new Error('Şifreni değiştirmek için tekrar giriş yap.')
  if (!currentPassword) throw new Error('Mevcut şifreni gir.')
  const validationError = validateNewPassword(password)
  if (validationError) throw new Error(validationError)
  const { data, error } = await auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (error) {
    if (error.code === 'invalid_credentials') throw new Error('Mevcut şifren yanlış.')
    throw error
  }
  if (data.user?.id !== user.id) throw new Error('Hesap doğrulanamadı. Tekrar giriş yap.')
  const { error: updateError } = await auth.updateUser({ current_password: currentPassword, password })
  if (updateError) throw updateError
}
