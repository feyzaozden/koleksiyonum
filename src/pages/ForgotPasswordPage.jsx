import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'E-posta gönderilemedi. Lütfen tekrar dene.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-title">Şifremi unuttum</div>
      <p className="auth-sub">Şifreni yenilemek için e-posta adresini gir.</p>
      <div className="auth-card">
        {error && <div className="auth-error" role="alert">{error}</div>}
        {sent ? (
          <p className="auth-switch" role="status">
            Bu adresle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.
            Gelen kutunu ve spam klasörünü kontrol et. E-postadaki bağlantıyla yeni şifreni belirleyebilirsin.
          </p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reset-email">E-posta</label>
              <input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} />
            </div>
            <button className="auth-btn" type="submit" disabled={submitting}>
              {submitting ? 'Gönderiliyor...' : 'Şifre sıfırlama bağlantısı gönder'}
            </button>
          </form>
        )}
        <div className="auth-switch"><Link to="/login">Giriş ekranına dön</Link></div>
      </div>
    </div>
  )
}
