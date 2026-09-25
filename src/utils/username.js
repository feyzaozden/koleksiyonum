export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_PATTERN = '[a-z][a-z0-9_.]{2,29}'
export const USERNAME_HINT = '3–30 karakter. Harfle başlar; a–z, 0–9, alt çizgi (_) ve nokta (.) kullanılabilir. Boşluk içeremez.'

export function normalizeUsername(value) {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

export function validateUsername(value) {
  return /^[a-z][a-z0-9_.]{2,29}$/.test(normalizeUsername(value)) ? null : USERNAME_HINT
}

export function usernameSearch(value) {
  return normalizeUsername(value.trim().replace(/^@/, ''))
}
