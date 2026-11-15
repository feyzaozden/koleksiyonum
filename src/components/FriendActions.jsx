import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'

export default function FriendActions({ personId, isPublic = false, compact = false, onComplete }) {
  const { user } = useAuth()
  const friends = useFriends()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const menu = useRef(null)
  const relation = friends.relationship(personId)
  if (personId === user.id) return null
  async function perform(action) {
    if (busy) return
    setBusy(true); setError('')
    try { await action(); setConfirming(false); if (menu.current) menu.current.open = false; onComplete?.() }
    catch (err) { setError(err.message || 'İşlem tamamlanamadı. Tekrar dene.') }
    finally { setBusy(false) }
  }
  const disabled = busy || friends.loading || !!friends.error
  if (!compact) return <div className="friend-actions discover-friend-actions">
    <div className="discover-friend-row">
      {relation?.status === 'accepted' ? <span className="friend-status">✓ Arkadaşsınız</span>
        : relation?.recipient_id === user.id ? <button className="primary" disabled={disabled} onClick={() => perform(() => friends.accept(relation.id))}>Kabul et</button>
          : relation ? <span className="friend-status">İstek bekliyor</span>
            : <button className="primary" disabled={disabled} onClick={() => perform(() => friends.send(personId))}>Arkadaş ekle</button>}
      {relation && <details className="discover-friend-menu" ref={menu} onToggle={e => { if (!e.currentTarget.open) setConfirming(false) }}>
        <summary aria-label="Diğer arkadaşlık işlemleri"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg></summary>
        <div className="discover-friend-panel">
          {relation.status === 'accepted' ? confirming ? <>
            <p>Arkadaşlıktan çıkarmak istiyor musun? Gizli hesapların içeriklerine erişim kapanır.</p>
            <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>Arkadaşlıktan çıkar</button>
            <button disabled={busy} onClick={() => setConfirming(false)}>Vazgeç</button>
          </> : <button disabled={disabled} onClick={() => setConfirming(true)}>Arkadaşlıktan çıkar</button>
            : relation.recipient_id === user.id ? <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>Reddet</button>
              : <>
                {isPublic && <button disabled={disabled} onClick={() => perform(() => friends.send(personId))}>Arkadaş ol</button>}
                <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>İsteği geri çek</button>
              </>}
        </div>
      </details>}
    </div>
    {busy && <span role="status">İşleniyor…</span>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>
  return (
    <div className={'friend-actions' + (compact ? ' friend-actions-compact' : '')}>
      {relation?.status === 'accepted' ? (
        confirming ? <>
          <span>Arkadaşlığı kaldırınca gizli hesapların içeriklerine erişim kapanır. Açık hesaplar görünmeye devam eder.</span>
          <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>Arkadaşlığı kaldır</button>
          <button disabled={busy} onClick={() => setConfirming(false)}>Vazgeç</button>
        </> : <><span className="friend-status">✓ Arkadaşsınız</span><button disabled={disabled} onClick={() => setConfirming(true)}>Arkadaşlıktan çıkar</button></>
      ) : relation?.recipient_id === user.id ? <>
        <button className="primary" disabled={disabled} onClick={() => perform(() => friends.accept(relation.id))}>Kabul et</button>
        <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>Reddet</button>
      </> : relation ? <>
        <span className="friend-status">İstek bekliyor</span>
        {isPublic && <button disabled={disabled} onClick={() => perform(() => friends.send(personId))}>Arkadaş ol</button>}
        <button disabled={disabled} onClick={() => perform(() => friends.remove(relation.id))}>İsteği geri çek</button>
      </> : <button className="primary" disabled={disabled} onClick={() => perform(() => friends.send(personId))}>Arkadaş ekle</button>}
      {busy && <span role="status">İşleniyor…</span>}
      {isPublic && relation?.status !== 'accepted' && <small>Açık hesap: eklediğinde doğrudan arkadaş olursunuz ve o da senin içeriklerini görebilir.</small>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  )
}
