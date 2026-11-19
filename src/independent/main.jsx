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
import { loadCollection, request, saveItem, saveCatalogItem, removeItem } from './client'
import ItemProgress, { ProgressDialog } from '../components/ItemProgress'
import ItemFormDialog from './ItemFormDialog'
import ItemMenu from './ItemMenu'
import DeleteConfirm from '../components/DeleteConfirm'
import './styles.css'
import tmdbLogo from '../../public/tmdb.svg?inline'
import ProfileDialog from './ProfileDialog'

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
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState('')
  const [finishing, setFinishing] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  function reload() { setEditor(null); setDeleting(null); setAttempt(value => value + 1) }
  async function save(payload, existing, selected) {
    const saved = selected ? await saveCatalogItem(payload, selected) : await saveItem(existing ? payload : { ...payload, emoji: TABS[payload.category].emoji }, existing)
    setItems(previous => existing ? previous.map(item => item.id === saved.id ? saved : item) : [saved, ...previous])
    if (!existing) { setSearch(''); setStatusFilter('tumu'); setSort('newest') }
    setNotice(existing ? 'Değişiklikler kaydedildi.' : 'İçerik koleksiyonuna eklendi.')
  }
  async function progress(id, patch, snapshot) {
    const saved = await saveItem(patch, snapshot || items.find(item => item.id === id))
    setItems(previous => previous.map(item => item.id === saved.id ? saved : item))
  }
  async function remove() {
    await removeItem(deleting)
    setItems(previous => previous.filter(item => item.id !== deleting.id))
    setNotice('İçerik silindi.')
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null); setItems([])
    async function load() {
      try {
        const session = await request('/auth/session', controller.signal)
        const { profile } = await request('/api/collection/profile', controller.signal)
        const collection = await loadCollection(controller.signal)
        if (controller.signal.aborted) return
        setUser({ ...session.user, ...profile }); setItems(collection)
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
  return <div className="app-shell independent-collection"><main className="main app-content">
    <section className="profile-hero"><div><h1>{user?.display_name || 'Koleksiyonum'}</h1>{user?.username && <p>@{user.username}</p>}{user?.bio && <p style={{ whiteSpace: 'pre-wrap' }}>{user.bio}</p>}{user && !loading && !error && <button type="button" className="btn-cancel" onClick={() => setProfileOpen(true)}>Profilim</button>}</div></section>
    <div className="tabs">{Object.entries(TABS).map(([key, value]) => <button type="button" key={key} className={'tab-btn' + (category === key ? ' active' : '')} aria-pressed={category === key} onClick={() => { setCategory(key); setStatusFilter('tumu') }}>{value.emoji} {value.label}</button>)}</div>
    {loading ? <p role="status">Koleksiyon yükleniyor…</p> : error ? <div role="alert"><p>{error.message}</p>{error.status === 401 ? <a href="/auth-test">Giriş yap</a> : <button type="button" onClick={() => setAttempt(value => value + 1)}>Tekrar dene</button>}</div> : <>
      <div className="collection-toolbar"><button type="button" className="btn-add" onClick={() => setEditor({ category, item: null })}>+ Yeni ekle</button><button type="button" className="btn-cancel" onClick={reload}>Listeyi yenile</button></div>
      <p role="status">{notice}</p>
      {category !== 'muzik' && <StatsBar items={items.filter(item => item.category === category)} collectionItems={items.filter(item => item.category !== 'muzik')} labels={tab.statusLabels} />}
      <FilterBar category={category} search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sort={sort} onSortChange={setSort} />
      <div className="items-grid">{visible.map(item => <article className="item-card" key={item.id}>
        <ItemMenu item={item} onFinish={() => setFinishing(item)} onEdit={() => setEditor({ category: item.category, item })} onDelete={() => setDeleting(item)} />
        {/^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(item.poster_path || '') ? <div className="item-cover"><img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={`${item.title} afişi`} loading="lazy" /></div> : <div className="item-emoji" aria-hidden="true">{item.emoji || tab.emoji}</div>}
        <div className="item-body"><h3 className="item-title">{item.title}</h3><p className="item-meta">{[item.creator, item.year].filter(Boolean).join(' · ')}</p>
          {category !== 'muzik' && <span className={'status-badge ' + item.status}>{tab.statusLabels[item.status]}</span>}
          {item.rating != null && <StarsDisplay rating={item.rating} />}
          {(item.start_date || item.end_date) && <p className="item-meta">{item.start_date && `Başlangıç: ${fmtDate(item.start_date)}`} {item.end_date && `Bitiş: ${fmtDate(item.end_date)}`}</p>}
          {item.note && <ItemNote note={item.note} />}
          {category !== 'muzik' && <ItemProgress item={item} isOwner onSave={(id, patch) => progress(id, patch, item)} />}
        </div>
      </article>)}</div>
      {!visible.length && <p className="empty">{search || statusFilter !== 'tumu' ? 'Bu filtrelere uygun içerik bulunamadı.' : 'Bu kategoride henüz içerik yok.'}</p>}
    </>}
    {editor && <ItemFormDialog category={editor.category} item={editor.item} onClose={() => setEditor(null)} onSave={save} onReload={reload} />}
    {deleting && <DeleteConfirm item={deleting} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} onSaved={profile => { setUser(previous => ({ ...previous, ...profile })); setNotice('Profil güncellendi.') }} />}
    {finishing && <ProgressDialog item={finishing} finish onClose={() => setFinishing(null)} onSave={(id, patch) => progress(id, patch, finishing)} />}
    <footer className="app-footer"><details className="app-footer-credits"><summary>Kaynaklar</summary><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src={tmdbLogo} alt="TMDB" width="80" height="32" /></a><p>Film ve dizi bilgileri TMDB’den sağlanır.</p><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></details></footer>
  </main></div>
}

createRoot(document.getElementById('root')).render(<CollectionApp />)
