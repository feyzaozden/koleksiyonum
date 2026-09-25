import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppHeader from '../components/AppHeader'
import { AVATAR_CHOICES } from '../constants/tabs'

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [bio, setBio] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_CHOICES[0])
  const [showAllAvatars, setShowAllAvatars] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setAvatarEmoji(profile.avatar_emoji || AVATAR_CHOICES[0])
    }
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!displayName.trim()) return
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), avatar_emoji: avatarEmoji, bio: bio.trim() })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  async function handleSignOut() {
    setSigningOut(true)
    setError(null)
    try { await signOut() }
    catch (err) { setError(err.message || 'Çıkış yapılamadı. Tekrar dene.') }
    finally { setSigningOut(false) }
  }

  return (
    <><AppHeader /><div className="auth-page profile-edit">
      <div className="auth-title">👤 Profilim</div>
      <p className="auth-sub">Kullanıcı adını, avatarını ve biyografini düzenle</p>
      <div className="auth-card">
        {error && <div className="auth-error">{error}</div>}
        {saved && (
          <div className="auth-error" style={{ background: '#e6f9ee', borderColor: '#8fdcae', color: '#166534' }}>
            Profil güncellendi.
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>E-posta</label>
            <input type="email" value={user.email} disabled />
          </div>
          <div className="auth-field">
            <label htmlFor="displayName">Kullanıcı adı</label>
            <input
              id="displayName"
              type="text"
              required
              maxLength={20}
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setSaved(false) }}
            />
          </div>
          <div className="auth-field">
            <label>Avatar</label>
            <div className="avatar-picker">
              {AVATAR_CHOICES.slice(0, showAllAvatars || AVATAR_CHOICES.indexOf(avatarEmoji) >= 18 ? AVATAR_CHOICES.length : 18).map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  className={'avatar-choice' + (avatarEmoji === emoji ? ' selected' : '')}
                  onClick={() => { setAvatarEmoji(emoji); setSaved(false) }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button className="avatar-toggle" type="button" onClick={() => setShowAllAvatars((current) => !current)}>
              {showAllAvatars ? 'Daha az gör' : 'Daha fazla gör'}
            </button>
          </div>
          <div className="auth-field">
            <label htmlFor="bio">Kısa biyografi</label>
            <textarea id="bio" maxLength={160} rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false) }} />
            <small>Keşfet’te herkes görebilir. {bio.length}/160</small>
          </div>
          <button className="auth-btn" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
        <div className="auth-switch">
          <Link to="/app">← Koleksiyona dön</Link>
        </div>
        <div className="profile-signout">
          <button className="btn-switch-user" type="button" disabled={signingOut || saving} onClick={handleSignOut}>{signingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}</button>
        </div>
      </div>
    </div></>
  )
}
