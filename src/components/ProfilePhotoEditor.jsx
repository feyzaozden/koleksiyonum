import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { saveProfilePhoto, validatePhoto } from '../utils/profilePhoto'
import ProfileAvatar from './ProfileAvatar'

export default function ProfilePhotoEditor({ profile, updateProfile, disabled, onBusyChange }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function selectFile(event) {
    const selected = event.target.files?.[0]
    if (!selected) return
    setError(''); setMessage(''); setFile(null)
    try { validatePhoto(selected); setFile(selected) }
    catch (err) { setError(err.message) }
    event.target.value = ''
  }

  async function save(remove = false) {
    if (busy || disabled) return
    if (remove && !window.confirm('Profil fotoğrafın kaldırılsın mı?')) return
    setBusy(true); onBusyChange(true); setError(''); setMessage('')
    try {
      setMessage(await saveProfilePhoto({ storage: supabase.storage, updateProfile, userId: profile.id, oldPath: profile.avatar_path, file: remove ? null : file }))
      setFile(null)
    } catch (err) { setError(err.message || 'Fotoğraf kaydedilemedi. Tekrar dene.') }
    finally { setBusy(false); onBusyChange(false) }
  }

  return <section className="profile-photo-editor" aria-labelledby="profile-photo-title" aria-busy={busy}>
    <h2 id="profile-photo-title">Profil fotoğrafı</h2>
    <div className="profile-photo-row">
      {preview ? <span className="profile-avatar"><img src={preview} alt="Seçilen fotoğrafın önizlemesi" onError={() => { setFile(null); setError('Bu fotoğraf açılamadı. Başka bir JPG, PNG veya WebP dosyası seç.') }} /></span> : <ProfileAvatar profile={profile} />}
      <div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={selectFile} disabled={busy || disabled} />
        <button className="avatar-toggle" type="button" disabled={busy || disabled} onClick={() => input.current.click()}>Fotoğraf seç</button>
        <p>JPG, PNG veya WebP · En fazla 5 MB</p>
      </div>
    </div>
    <div className="profile-photo-actions">
      {file && <><button className="auth-btn" type="button" disabled={busy || disabled} onClick={() => save()}>{busy ? 'Yükleniyor…' : 'Fotoğrafı yükle'}</button><button className="avatar-toggle" type="button" disabled={busy || disabled} onClick={() => setFile(null)}>Vazgeç</button></>}
      {profile.avatar_path && !file && <button className="avatar-toggle" type="button" disabled={busy || disabled} onClick={() => save(true)}>Fotoğrafı kaldır</button>}
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>
}
