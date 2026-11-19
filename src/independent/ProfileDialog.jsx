import { useEffect, useRef, useState } from 'react'
import { normalizeUsername, validateUsername, USERNAME_HINT } from '../utils/username'
import { request } from './client'

export default function ProfileDialog({ onClose, onSaved }) {
  const dialog = useRef(null), locked = useRef(false)
  const [profile, setProfile] = useState(null), [error, setError] = useState(null)
  const [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const element = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setProfile(null); setError(null)
    request('/api/collection/profile', controller.signal).then(data => {
      if (!controller.signal.aborted) setProfile(data.profile)
    }).catch(err => { if (!controller.signal.aborted) setError(err) })
    return () => controller.abort()
  }, [attempt])
  async function submit(event) {
    event.preventDefault()
    if (locked.current) return
    const validation = validateUsername(profile.username)
    if (validation) { setError(new Error(validation)); return }
    locked.current = true; setBusy(true); setError(null)
    try {
      const { username, display_name, bio, revision } = profile
      const data = await request('/api/collection/profile', undefined, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, display_name, bio, revision }) })
      onSaved(data.profile); onClose()
    } catch (err) { setError(err) }
    finally { locked.current = false; setBusy(false) }
  }
  const set = (key, value) => setProfile(previous => ({ ...previous, [key]: value }))
  return <dialog ref={dialog} className="add-item-dialog" aria-labelledby="profile-dialog-title" onCancel={event => { event.preventDefault(); if (!locked.current) onClose() }}>
    <div className="add-item-dialog-heading"><h2 id="profile-dialog-title">Profilim</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Kapat">×</button></div>
    {!profile && !error && <p role="status">Profil yükleniyor…</p>}
    {profile && <form className="add-form" onSubmit={submit}><fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
      <label>Kullanıcı adı<input required minLength={3} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={profile.username} onChange={event => set('username', normalizeUsername(event.target.value))} aria-describedby="username-help" /></label>
      <small id="username-help">{USERNAME_HINT}</small>
      <label>Ad soyad<input required maxLength={80} autoComplete="name" value={profile.display_name} onChange={event => set('display_name', event.target.value)} /></label>
      <label>Biyografi<textarea maxLength={160} rows={3} value={profile.bio} onChange={event => set('bio', event.target.value)} /></label>
    </fieldset><div className="modal-actions"><button type="button" className="btn-cancel" disabled={busy} onClick={onClose}>Vazgeç</button><button type="submit" className="btn-save" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></div></form>}
    {error && <div className="auth-error" role="alert"><p>{error.message}</p>{error.status === 401 ? <a href="/auth-test">Giriş yap</a> : <button type="button" className="btn-cancel" disabled={busy} onClick={() => setAttempt(value => value + 1)}>{profile ? 'Değişikliklerden vazgeç ve güncel profili yükle' : 'Tekrar dene'}</button>}</div>}
  </dialog>
}
