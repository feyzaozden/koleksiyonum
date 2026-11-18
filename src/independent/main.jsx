import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import FilterBar from '../components/FilterBar'
import StatsBar from '../components/StatsBar'
import ItemNote from '../components/ItemNote'
import StarsDisplay from '../components/StarsDisplay'
import { TABS } from '../constants/tabs'
import { filterAndSortItems } from '../utils/filterSort'
import { fmtDate } from '../utils/format'
import { loadCollection, request } from './client'

function CollectionApp() {
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [category, setCategory] = useState('kitap')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('tumu')
  const [sort, setSort] = useState('newest')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null); setItems([])
    async function load() {
      try {
        const session = await request('/auth/session', controller.signal)
        const collection = await loadCollection(controller.signal)
        if (controller.signal.aborted) return
        setUser(session.user); setItems(collection)
      } catch (err) {
        if (!controller.signal.aborted) { setError(err); if (err.status === 401) setUser(null) }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    load()
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    for (const suffix of ['', '-light', '-pale', '-glow']) document.documentElement.style.setProperty(`--active${suffix}`, `var(--${TABS[category].colorVar}${suffix})`)
  }, [category])
  const tab = TABS[category]
  const visible = filterAndSortItems(items, { category, search, statusFilter, sort })
  return <div className="app-shell"><main className="main app-content">
    <section className="profile-hero"><div><h1>{user?.display_name || 'Koleksiyonum'}</h1>{user?.username && <p>@{user.username}</p>}</div></section>
    <div className="tabs">{Object.entries(TABS).map(([key, value]) => <button type="button" key={key} className={'tab-btn' + (category === key ? ' active' : '')} aria-pressed={category === key} onClick={() => { setCategory(key); setStatusFilter('tumu') }}>{value.emoji} {value.label}</button>)}</div>
    {loading ? <p role="status">Koleksiyon yükleniyor…</p> : error ? <div role="alert"><p>{error.message}</p>{error.status === 401 ? <a href="/auth-test">Giriş yap</a> : <button type="button" onClick={() => setAttempt(value => value + 1)}>Tekrar dene</button>}</div> : <>
      {category !== 'muzik' && <StatsBar items={items.filter(item => item.category === category)} collectionItems={items.filter(item => item.category !== 'muzik')} labels={tab.statusLabels} />}
      <FilterBar category={category} search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sort={sort} onSortChange={setSort} />
      <div className="items-grid">{visible.map(item => <article className="item-card" key={item.id}>
        <div className="item-emoji" aria-hidden="true">{item.emoji || tab.emoji}</div>
        <div className="item-body"><h3 className="item-title">{item.title}</h3><p className="item-meta">{[item.creator, item.year].filter(Boolean).join(' · ')}</p>
          {category !== 'muzik' && <span className={'status-badge ' + item.status}>{tab.statusLabels[item.status]}</span>}
          {item.rating != null && <StarsDisplay rating={item.rating} />}
          {(item.start_date || item.end_date) && <p className="item-meta">{item.start_date && `Başlangıç: ${fmtDate(item.start_date)}`} {item.end_date && `Bitiş: ${fmtDate(item.end_date)}`}</p>}
          {item.note && <ItemNote note={item.note} />}
        </div>
      </article>)}</div>
      {!visible.length && <p className="empty">{search || statusFilter !== 'tumu' ? 'Bu filtrelere uygun içerik bulunamadı.' : 'Bu kategoride henüz içerik yok.'}</p>}
    </>}
  </main></div>
}

createRoot(document.getElementById('root')).render(<CollectionApp />)
