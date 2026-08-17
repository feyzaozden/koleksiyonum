import StarsDisplay from './StarsDisplay'
import { fmtDate } from '../utils/format'

export default function ItemCard({ item, isOwner, labels, ownerName, showOwner, onStatusChange, onEdit, onDelete }) {
  const meta = [item.creator, item.year].filter(Boolean).join(' · ')
  const sd = fmtDate(item.start_date)
  const ed = fmtDate(item.end_date)
  const imdbUrl = 'https://www.imdb.com/find?q=' + encodeURIComponent(item.title) + '&s=tt'
  const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(item.title + ' fragman trailer')
  const statusIcon = item.status === 'bekliyor' ? '⏳' : item.status === 'devam' ? '▶️' : '✅'

  return (
    <div className="item-card">
      <div className="item-emoji">{item.emoji}</div>
      <div className="item-body">
        <div className="item-title">{item.title}</div>
        {meta && <div className="item-meta">{meta}</div>}
        {(sd || ed) && (
          <div className="item-dates">
            {sd && <span>📅 {sd}</span>}
            {ed && <span>🏁 {ed}</span>}
          </div>
        )}
        <StarsDisplay rating={item.rating} />
        {item.note && <div className="item-note">&quot;{item.note}&quot;</div>}
        {showOwner && <div className="item-owner-tag">{ownerName}</div>}
      </div>
      <div className="item-actions">
        {isOwner ? (
          <select
            className="status-select"
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
          <button className="btn-edit" onClick={() => onEdit(item)} title="Düzenle">✏️</button>
        )}
        {isOwner && (
          <button className="btn-delete" onClick={() => onDelete(item.id)} title="Sil">×</button>
        )}
      </div>
    </div>
  )
}
