import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { useProfiles } from '../hooks/useProfiles'

const CAT_LABELS = { kitap: '📚 Kitap', film: '🎬 Film', dizi: '📺 Dizi' }
const CAT_FILTERS = [
  { value: 'tumu', label: 'Tümü' },
  { value: 'kitap', label: '📚 Kitap' },
  { value: 'film', label: '🎬 Film' },
  { value: 'dizi', label: '📺 Dizi' },
]

export default function ImdbPage() {
  const { items } = useItems()
  const { byId } = useProfiles()
  const [cat, setCat] = useState('tumu')
  const [userFilter, setUserFilter] = useState('tumu')

  const list = useMemo(() => {
    let filtered = items.filter((i) => i.rating || i.note)
    if (cat !== 'tumu') filtered = filtered.filter((i) => i.category === cat)
    if (userFilter !== 'tumu') filtered = filtered.filter((i) => i.user_id === userFilter)

    const grouped = {}
    filtered.forEach((item) => {
      const key = item.title.toLowerCase() + '__' + item.category
      if (!grouped[key]) {
        grouped[key] = { title: item.title, category: item.category, emoji: item.emoji, creator: item.creator, year: item.year, ratings: {}, notes: {} }
      }
      if (item.rating) grouped[key].ratings[item.user_id] = item.rating
      if (item.note) grouped[key].notes[item.user_id] = item.note
    })

    const arr = Object.values(grouped).map((g) => {
      const rvals = Object.values(g.ratings)
      const avg = rvals.length ? rvals.reduce((a, b) => a + b, 0) / rvals.length : null
      return { ...g, avg }
    })

    arr.sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0
      if (a.avg === null) return 1
      if (b.avg === null) return -1
      return b.avg - a.avg
    })
    return arr
  }, [items, cat, userFilter])

  const ratedUserIds = useMemo(() => {
    const ids = new Set()
    items.forEach((i) => { if (i.rating || i.note) ids.add(i.user_id) })
    return [...ids]
  }, [items])

  return (
    <div>
      <div className="imdb-header">
        <div className="imdb-logo">IMDb <span>Koleksiyon Listesi</span></div>
        <Link className="btn-imdb-back" to="/app">← Geri</Link>
      </div>
      <div className="imdb-main">
        <div className="imdb-filters">
          {CAT_FILTERS.map((f) => (
            <button
              key={f.value}
              className={'imdb-filter-btn' + (cat === f.value ? ' active' : '')}
              onClick={() => setCat(f.value)}
            >
              {f.label}
            </button>
          ))}
          <select className="imdb-user-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="tumu">Herkes</option>
            {ratedUserIds.map((uid) => (
              <option key={uid} value={uid}>{byId[uid] ? byId[uid].display_name : 'Bilinmeyen'}</option>
            ))}
          </select>
        </div>

        <div className="imdb-list">
          {list.length === 0 ? (
            <div className="imdb-empty">
              <div className="imdb-empty-icon">⭐</div>
              <h3>Henüz puan verilmemiş</h3>
              <p>Koleksiyona öğe ekleyip puan ver.</p>
            </div>
          ) : (
            list.map((item, idx) => {
              const rank = idx + 1
              const isTop3 = rank <= 3
              const avgDisp = item.avg !== null ? (Math.round(item.avg * 10) / 10).toFixed(1) : null
              const filled = item.avg !== null ? Math.round(item.avg) : 0
              const meta = [item.creator, item.year].filter(Boolean).join(' · ')
              const noteUids = Object.keys(item.notes)
              const ratingUids = Object.keys(item.ratings)

              return (
                <div className="imdb-card" key={item.category + '__' + item.title}>
                  <div className={'imdb-rank' + (isTop3 ? ' top3' : '')}>{rank}</div>
                  <div className="imdb-emoji">{item.emoji}</div>
                  <div className="imdb-body">
                    <span className={'imdb-cat-badge ' + item.category}>{CAT_LABELS[item.category]}</span>
                    <div className="imdb-title">{item.title}</div>
                    {meta && <div className="imdb-meta">{meta}</div>}
                    <div className="imdb-score-row">
                      {avgDisp ? (
                        <div className="imdb-score-box">{avgDisp}</div>
                      ) : (
                        <div className="imdb-no-rating">Henüz puan yok</div>
                      )}
                      {avgDisp && (
                        <div className="imdb-stars-row">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
                            <span key={i} className={'imdb-star' + (i > filled ? ' off' : '')}>★</span>
                          ))}
                        </div>
                      )}
                      {userFilter === 'tumu' && ratingUids.length > 0 && (
                        <span className="imdb-votes">
                          ({ratingUids.map((uid) => `${byId[uid] ? byId[uid].display_name.split(' ')[0] : '?'}: ${item.ratings[uid]}`).join(' · ')})
                        </span>
                      )}
                    </div>
                    {noteUids.length > 0 && (
                      <div className="imdb-notes">
                        {noteUids.map((uid) => (
                          <div className="imdb-note-item" key={uid}>
                            <span className="imdb-note-who">{byId[uid]?.avatar_emoji} {byId[uid]?.display_name}:</span> {item.notes[uid]}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
