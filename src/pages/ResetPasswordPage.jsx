import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PasswordRequirements from '../components/PasswordRequirements'
import { PASSWORD_MIN_LENGTH } from '../utils/authValidation'

// Capture callback errors before the auth client can remove the URL fragment.
const callbackParams = new URLSearchParams(window.location.hash.slice(1))
const callbackFailed = callbackParams.has('error') || callbackParams.has('error_code') || new URLSearchParams(window.location.search).has('error')

export default function ResetPasswordPage() {
  const { session, loading, resetPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    if (password !== confirmation) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(password)
      setPassword('')
      setConfirmation('')
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Şifre güncellenemedi. Lütfen tekrar dene.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-title">Yeni şifre belirle</div>
      <p className="auth-sub">Hesabın için yeni bir şifre oluştur.</p>
      <div className="auth-card">
        {loading ? <p role="status">Bağlantı kontrol ediliyor...</p> : saved ? (
          <>
            <p className="auth-switch" role="status">Şifren güncellendi. Sonraki girişinde yeni şifreni kullanabilirsin.</p>
            <div className="auth-switch"><Link to="/app">Koleksiyonuma git</Link></div>
          </>
        ) : callbackFailed || !session ? (
          <>
            <div className="auth-error" role="alert">Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. E-postandaki en son bağlantıyı aç ya da yeni bir bağlantı iste.</div>
            <div className="auth-switch"><Link to="/forgot-password">Yeni bağlantı gönder</Link></div>
          </>
        ) : (
          <>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="new-password">Yeni şifre</label>
                <input id="new-password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} aria-describedby="reset-password-rules" />
                <PasswordRequirements password={password} id="reset-password-rules" />
              </div>
              <div className="auth-field">
                <label htmlFor="confirm-password">Yeni şifre tekrar</label>
                <input id="confirm-password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={submitting} />
              </div>
              <button className="auth-btn" type="submit" disabled={submitting}>{submitting ? 'Kaydediliyor...' : 'Şifremi güncelle'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
