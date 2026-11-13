import ItemProgress from './ItemProgress'
import ItemCover from './ItemCover'
import { useState } from 'react'
import PosterPicker from './PosterPicker'
import ItemReactions from './ItemReactions'
import StarsDisplay from './StarsDisplay'
import { fmtDate } from '../utils/format'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'

export default function ItemCard({ item, isOwner, labels, ownerName, showOwner, onStatusChange, onEdit, onDelete, onProgress, reactions, commentCount }) {
  const location = useLocation()
  const [picker, setPicker] = useState(false)
  const [linked, setLinked] = useState(null)
  const displayedItem = linked?.id === item.id ? { ...item, poster_path: linked.poster_path, source: linked.source, source_id: linked.source_id } : item
  const { user } = useAuth()
  const friends = useFriends()
  const canComment = item.user_id === user?.id || friends.friendIds.includes(item.user_id)
  const meta = [item.creator, item.year].filter(Boolean).join(' · ')
  const sd = fmtDate(item.start_date)
  const ed = fmtDate(item.end_date)
  const imdbUrl = 'https://www.imdb.com/find?q=' + encodeURIComponent(item.title) + '&s=tt'
  const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(item.title + ' fragman trailer')
  const statusIcon = item.status === 'bekliyor' ? '⏳' : item.status === 'devam' ? '▶️' : '✅'

  return (
    <div className="item-card" id={`item-${item.id}`} tabIndex={-1}>
      <ItemCover item={displayedItem} />
      {picker && <PosterPicker item={displayedItem} onClose={() => setPicker(false)} onSaved={saved => { setLinked(saved); setPicker(false) }} />}
      <div className="item-body">
        <div className="item-title">{item.title}</div>
        {meta && <div className="item-meta">{meta}</div>}
        {(sd || ed) && (
          <div className="item-dates">
            {sd && <span>📅 {sd}</span>}
            {ed && <span>🏁 {ed}</span>}
          </div>
        )}
        <ItemProgress item={item} isOwner={isOwner} onSave={onProgress} />
        <StarsDisplay rating={item.rating} />
        {item.note && <div className="item-note">&quot;{item.note}&quot;</div>}
        {showOwner && <div className="item-owner-tag">{ownerName}</div>}
        {reactions && <ItemReactions item={item} counts={reactions.data[item.id]} busy={reactions.isBusy(item.id)} loadError={reactions.error} onReact={reactions.react} onRetry={reactions.refresh} />}
        {canComment && <Link className="comment-link" to={`/items/${item.id}/comments`}
          state={{ returnTo: { path: location.pathname + location.search, key: location.state?.restoreKey || location.key, index: window.history.state?.idx, userId: user.id } }}
          onClick={() => {
            const key = location.state?.restoreKey || location.key
            try {
              sessionStorage.setItem(`page-scroll:${user.id}:${key}`, String(window.scrollY))
              sessionStorage.setItem(`page-anchor:${user.id}:${key}`, JSON.stringify({ id: `item-${item.id}`, offset: document.getElementById(`item-${item.id}`)?.getBoundingClientRect().top || 0 }))
            } catch { /* optional storage */ }
          }}>💬 Yorumlar{commentCount != null ? ` (${commentCount})` : ''}</Link>}
      </div>
      <div className="item-actions">
        {isOwner && ['film','dizi'].includes(item.category) && !displayedItem.poster_path && !displayedItem.source_id && <button className="poster-pick-button" onClick={() => setPicker(true)}>Afiş seç</button>}
        {isOwner ? (
          <select
            className="status-select"
            aria-label={`${item.title} durumu`}
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value)}
          >
            <option value="bekliyor">⏳ {labels.bekliyor}</option>
            <option value="devam">▶️ {labels.devam}</option>
            <option value="bitti">✅ {labels.bitti}</option>
          </select>
        ) : (
          <span className="status-badge">{statusIcon} {labels[item.status]}</span>
        )}
        <a href={imdbUrl} target="_blank" rel="noreferrer" className="btn-link imdb" title="IMDb">IMDb</a>
        <a href={ytUrl} target="_blank" rel="noreferrer" className="btn-link yt" title="Fragman">&#9654;</a>
        {isOwner && (
          <button className="btn-edit" onClick={() => onEdit(item)} title="Düzenle" aria-label={`${item.title} öğesini düzenle`}>✏️</button>
        )}
        {isOwner && (
          <button className="btn-delete" onClick={() => onDelete(item.id)} title="Sil" aria-label={`${item.title} öğesini sil`}>×</button>
        )}
      </div>
    </div>
  )
}
