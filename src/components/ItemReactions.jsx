import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function Thumb({ down }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 2 2 5l-1 3h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7" />
  </svg>
}

export default function ItemReactions({ item, counts, busy, loadError, onReact, onRetry }) {
  const { user } = useAuth()
  const [error, setError] = useState('')
  const own = item.user_id === user?.id
  async function vote(value) {
    setError('')
    try { await onReact(item.id, counts.my_reaction === value ? null : value) }
    catch (e) { setError(e.message) }
  }
  return <div className="item-reactions-area">
    <div className="item-reactions" role="group" aria-label={`${item.title} beğenileri`}>
      {[{ value: 1, label: 'Beğen', count: counts?.likes }, { value: -1, label: 'Beğenme', count: counts?.dislikes }].map(({ value, label, count }) => own
        ? <span key={value} className="item-reaction-count" aria-label={`${label}: ${count ?? 'yükleniyor'}`}><Thumb down={value === -1} /><span>{count ?? '—'}</span></span>
        : <button key={value} type="button" disabled={busy || !counts || loadError} aria-pressed={counts?.my_reaction === value}
          aria-label={`${label}: ${count ?? 'yükleniyor'}${counts?.my_reaction === value ? ', oyunu geri al' : ''}`}
          title={counts?.my_reaction === value ? 'Oyunu geri al' : label} onClick={() => vote(value)}>
          <Thumb down={value === -1} /><span>{count ?? '—'}</span>
        </button>)}
    </div>
    {loadError && <p className="item-reaction-error">Beğeniler yüklenemedi. <button type="button" onClick={onRetry}>Tekrar dene</button></p>}
    {error && <p className="item-reaction-error" role="alert">{error}</p>}
  </div>
}
