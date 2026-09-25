export const PASSWORD_MIN_LENGTH = 8

export function passwordRules(password) {
  return [
    { label: `En az ${PASSWORD_MIN_LENGTH} karakter`, met: Array.from(password).length >= PASSWORD_MIN_LENGTH },
    { label: 'En az bir büyük harf (A–Z)', met: /[A-Z]/.test(password) },
    { label: 'En az bir küçük harf (a–z)', met: /[a-z]/.test(password) },
    { label: 'En az bir rakam (0–9)', met: /[0-9]/.test(password) },
  ]
}

export function validateNewPassword(password) {
  const missing = passwordRules(password).filter((rule) => !rule.met)
  return missing.length ? 'Şifre gereksinimleri: ' + missing.map((rule) => rule.label).join(', ') + '.' : null
}

// Practical public-internet email validation, not proof of mailbox ownership.
// Preserve plus aliases, dots and local-part casing; trim only outside whitespace.
export function validateEmail(email) {
  const value = email.trim()
  if (value.length > 254) return 'E-posta adresi çok uzun.'
  const parts = value.split('@')
  if (parts.length !== 2) return 'Geçerli bir e-posta adresi gir (örnek: ad@ornek.com).'
  const [local, domain] = parts
  const labels = domain.split('.')
  const valid = local.length > 0 && local.length <= 64 &&
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    labels.length >= 2 && labels.every((label) => label.length <= 63 && /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label))
  return valid ? null : 'Geçerli bir e-posta adresi gir (örnek: ad@ornek.com). Boşluk kullanma.'
}
