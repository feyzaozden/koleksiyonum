import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AVATAR_CHOICES } from '../constants/tabs'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_CHOICES[0])
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await signUp({ email, password, displayName, avatarEmoji })
      setInfo('Kayıt başarılı! E-postana gelen onay bağlantısına tıkladıktan sonra giriş yapabilirsin.')
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-title">📚 Koleksiyonum</div>
      <p className="auth-sub">Yeni bir hesap oluştur</p>
      <div className="auth-card">
        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-error" style={{ background: '#e6f9ee', borderColor: '#8fdcae', color: '#166534' }}>{info}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="displayName">Görünen İsim</label>
            <input id="displayName" type="text" required maxLength={20} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ad Soyad" />
          </div>
          <div className="auth-field">
            <label htmlFor="email">E-posta</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Şifre</label>
            <input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="auth-field">
            <label>Avatar</label>
            <div className="avatar-picker">
              {AVATAR_CHOICES.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  className={'avatar-choice' + (avatarEmoji === emoji ? ' selected' : '')}
                  onClick={() => setAvatarEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
          </button>
        </form>
        <div className="auth-switch">
          Zaten hesabın var mı? <Link to="/login">Giriş yap</Link>
        </div>
      </div>
    </div>
  )
}
