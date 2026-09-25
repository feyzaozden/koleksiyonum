import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PASSWORD_MIN_LENGTH, validateNewPassword } from '../utils/authValidation'
import PasswordRequirements from './PasswordRequirements'

export default function ChangePasswordForm({ disabled = false, onBusyChange }) {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inFlight = useRef(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (inFlight.current || disabled) return
    setSaved(false)
    const validationError = validateNewPassword(password) || (password !== confirmation ? 'Şifreler eşleşmiyor.' : '')
    setError(validationError)
    if (validationError) return
    inFlight.current = true
    setBusy(true)
    onBusyChange(true)
    try {
      await changePassword(currentPassword, password)
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
      setSaved(true)
      setExpanded(false)
    } catch (err) {
      setError(err.message || 'Şifre değiştirilemedi. Lütfen tekrar dene.')
    } finally {
      inFlight.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  function toggle() {
    setExpanded(!expanded)
    setCurrentPassword('')
    setPassword('')
    setConfirmation('')
    setError('')
    setSaved(false)
  }

  return <section className="profile-password" aria-label="Şifre değiştirme">
    <button className="password-toggle" type="button" aria-expanded={expanded} aria-controls="profile-password-form" disabled={busy || disabled} onClick={toggle}>
      <span>Şifre değiştir</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    {saved && <p className="password-success" role="status">Şifren güncellendi. Sonraki girişinde yeni şifreni kullanabilirsin.</p>}
    <form id="profile-password-form" className="auth-form" hidden={!expanded} onSubmit={handleSubmit}>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="auth-field">
        <label htmlFor="profile-current-password">Mevcut şifre</label>
        <input id="profile-current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy || disabled} />
      </div>
      <div className="auth-switch"><Link to="/forgot-password">Şifremi unuttum</Link></div>
      <div className="auth-field">
        <label htmlFor="profile-new-password">Yeni şifre</label>
        <input id="profile-new-password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy || disabled} aria-describedby="profile-password-rules" />
      </div>
      <div className="auth-field">
        <label htmlFor="profile-confirm-password">Yeni şifre tekrar</label>
        <input id="profile-confirm-password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy || disabled} aria-describedby="profile-password-rules" />
      </div>
      <PasswordRequirements password={password} id="profile-password-rules" />
      <button className="auth-btn" type="submit" disabled={busy || disabled}>{busy ? 'Şifre güncelleniyor…' : 'Şifremi güncelle'}</button>
    </form>
  </section>
}
