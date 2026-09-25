import { normalizeUsername, USERNAME_HINT, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from '../utils/username'

export default function UsernameField({ value, onChange, disabled = false }) {
  return <div className="auth-field">
    <label htmlFor="username">Kullanıcı adı</label>
    <input id="username" name="username" type="text" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
      minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} pattern={USERNAME_PATTERN} title={USERNAME_HINT}
      placeholder="ornek.kullanici" value={value} disabled={disabled} onChange={(event) => onChange(normalizeUsername(event.target.value))} aria-describedby="username-hint" />
    <small id="username-hint">{USERNAME_HINT}</small>
  </div>
}
