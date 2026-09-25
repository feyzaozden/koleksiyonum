import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'

export default function FriendActions({ personId }) {
  const { user } = useAuth()
  const friends = useFriends()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const relation = friends.relationship(personId)
  if (personId === user.id) return null
  async function perform(action) {
    if (busy) return
    setBusy(true); setError('')
    try { await action(); setConfirming(false) }
    catch (err) { setError(err.message || 'İşlem tamamlanamadı. Tekrar dene.') }
    finally { setBusy(false) }
  }
  const disabled = busy || friends.loading || !!friends.error
  return (
    <div className="friend-actions">
      {relation?.status === 'accepted' ? (
        confirming ? <>
          <span>Arkadaşlığı kaldırınca koleksiyonlarınız birbirinize kapanır.</span>
          <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>Arkadaşlığı kaldır</button>
          <button disabled={busy} onClick={() => setConfirming(false)}>Vazgeç</button>
        </> : <><span className="friend-status">✓ Arkadaşsınız</span><button disabled={disabled} onClick={() => setConfirming(true)}>Arkadaşlıktan çıkar</button></>
      ) : relation?.recipient_id === user.id ? <>
        <button className="primary" disabled={disabled} onClick={() => perform(() => friends.accept(relation.id))}>Kabul et</button>
        <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>Reddet</button>
      </> : relation ? <>
        <span className="friend-status">İstek bekliyor</span>
        <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>İsteği geri çek</button>
      </> : <button className="primary" disabled={disabled} onClick={() => perform(() => friends.send(personId))}>Arkadaş ekle</button>}
      {busy && <span role="status">İşleniyor…</span>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  )
}
