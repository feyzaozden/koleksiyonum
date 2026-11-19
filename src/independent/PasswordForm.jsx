import { useRef, useState } from 'react'
import PasswordRequirements from '../components/PasswordRequirements'
import { validateNewPassword } from '../utils/authValidation'
import { request } from './client'

export default function PasswordForm({ disabled, onBusyChange }) {
  const [expanded, setExpanded] = useState(false), [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null), [message, setMessage] = useState('')
  const locked = useRef(false)
  async function run(action) {
    if (locked.current || disabled) return
    locked.current = true; setBusy(true); onBusyChange(true); setError(null); setMessage('')
    try { await action() } catch (err) { setError(err) }
    finally { locked.current = false; setBusy(false); onBusyChange(false) }
  }
  function submit(event) {
    event.preventDefault()
    const validation = validateNewPassword(password) || (password.length > 128 ? 'Şifre en fazla 128 karakter olabilir.' : '') || (password !== confirmation ? 'Şifreler eşleşmiyor.' : '')
    if (validation) { setError(new Error(validation)); return }
    run(async () => {
      await request('/api/collection/password', undefined, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({current_password:current,password,password_confirmation:confirmation}) })
      setCurrent(''); setPassword(''); setConfirmation(''); setExpanded(false)
      setMessage('Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı; burada devam edebilirsin.')
    })
  }
  function forgot() {
    run(async () => {
      const { user } = await request('/auth/session')
      await request('/auth/forgot-password',undefined,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email}) })
      setMessage('Hesabın uygunsa şifre sıfırlama bağlantısı e-posta adresine gönderildi.')
    })
  }
  return <section className="profile-password" aria-label="Şifre değiştirme">
    <button type="button" className="password-toggle" disabled={disabled || busy} aria-expanded={expanded} aria-controls="independent-password-form" onClick={() => { setExpanded(value => !value); setCurrent(''); setPassword(''); setConfirmation(''); setError(null); setMessage('') }}><span>Şifre değiştir</span><span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    {message && <p role="status" className="password-success">{message}</p>}
    <form id="independent-password-form" className="auth-form" hidden={!expanded} onSubmit={submit}>
      <div className="auth-field"><label htmlFor="current-password">Mevcut şifre</label><input id="current-password" type="password" required maxLength={128} autoComplete="current-password" value={current} disabled={busy || disabled} onChange={e => setCurrent(e.target.value)} /></div>
      <button type="button" className="btn-cancel" disabled={busy || disabled} onClick={forgot}>Şifremi unuttum</button>
      <div className="auth-field"><label htmlFor="new-password">Yeni şifre</label><input id="new-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} disabled={busy || disabled} onChange={e => setPassword(e.target.value)} aria-describedby="new-password-rules" /></div>
      <div className="auth-field"><label htmlFor="confirm-password">Yeni şifre tekrar</label><input id="confirm-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} disabled={busy || disabled} onChange={e => setConfirmation(e.target.value)} aria-describedby="new-password-rules" /></div>
      <PasswordRequirements password={password} id="new-password-rules" />
      <button type="submit" className="auth-btn" disabled={busy || disabled}>{busy ? 'İşleniyor…' : 'Şifremi güncelle'}</button>
    </form>
    {error && <div role="alert" className="auth-error">{error.message}{error.status === 401 && <a href="/auth-test"> Giriş yap</a>}</div>}
  </section>
}
