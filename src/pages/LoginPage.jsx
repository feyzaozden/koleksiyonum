import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn({ email, password })
      navigate('/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-title">📚 Koleksiyonum</div>
      <p className="auth-sub">Kitap, film ve dizi koleksiyonuna giriş yap</p>
      <div className="auth-card">
        {error && <div className="auth-error">{error}</div>}
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
