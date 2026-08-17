import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function isUnconfirmedError(err) {
  return err?.code === 'email_not_confirmed' || /email.*not.*confirm/i.test(err?.message || '')
}

export default function LoginPage() {
  const { signIn, resendConfirmation } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendState, setResendState] = useState('idle') // idle | sending | sent
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setUnconfirmed(false)
    setResendState('idle')
    setSubmitting(true)
    try {
      await signIn({ email, password })
      navigate('/app')
    } catch (err) {
      setError(err.message)
      setUnconfirmed(isUnconfirmedError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResendState('sending')
    try {
      await resendConfirmation(email)
      setResendState('sent')
    } catch (err) {
      setError(err.message)
      setResendState('idle')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-title">📚 Koleksiyonum</div>
      <p className="auth-sub">Kitap, film ve dizi koleksiyonuna giriş yap</p>
      <div className="auth-card">
        {error && <div className="auth-error">{error}</div>}
        {unconfirmed && (
          <div className="auth-switch">
            {resendState === 'sent' ? (
              'Yeni onay e-postası gönderildi, gelen kutunu kontrol et.'
            ) : (
              <>
                E-postanı henüz onaylamadın.{' '}
                <a onClick={resendState === 'sending' ? undefined : handleResend}>
                  {resendState === 'sending' ? 'Gönderiliyor...' : 'Onay e-postasını tekrar gönder'}
                </a>
              </>
            )}
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">E-posta</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Şifre</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
        <div className="auth-switch">
          Hesabın yok mu? <Link to="/signup">Kayıt ol</Link>
        </div>
      </div>
    </div>
  )
}
