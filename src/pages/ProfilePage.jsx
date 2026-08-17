import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AVATAR_CHOICES } from '../constants/tabs'

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_CHOICES[0])
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
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
      await updateProfile({ display_name: displayName.trim(), avatar_emoji: avatarEmoji })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  return (
    <div className="auth-page">
      <div className="auth-title">👤 Profilim</div>
      <p className="auth-sub">Görünen adını ve avatarını değiştir</p>
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
            <label htmlFor="displayName">Görünen İsim</label>
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
              {AVATAR_CHOICES.map((emoji) => (
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
          </div>
          <button className="auth-btn" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
        <div className="auth-switch">
          <Link to="/app">← Koleksiyona dön</Link>
        </div>
      </div>
    </div>
  )
}
