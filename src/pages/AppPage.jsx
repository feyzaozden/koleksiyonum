import ProfileAvatar from '../components/ProfileAvatar'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useItems } from '../hooks/useItems'
import AppHeader from '../components/AppHeader'
import { useErrorToast } from '../hooks/useErrorToast'
import { TABS } from '../constants/tabs'
import { filterAndSortItems } from '../utils/filterSort'
import AddForm from '../components/AddForm'
import FilterBar from '../components/FilterBar'
import StatsBar from '../components/StatsBar'
import ItemsGrid from '../components/ItemsGrid'
import EditModal from '../components/EditModal'
import ErrorToast from '../components/ErrorToast'
import DeleteConfirm from '../components/DeleteConfirm'

function applyTabTheme(tab) {
  const cv = TABS[tab].colorVar
  const r = document.documentElement
  r.style.setProperty('--active', `var(--${cv})`)
  r.style.setProperty('--active-light', `var(--${cv}-light)`)
  r.style.setProperty('--active-pale', `var(--${cv}-pale)`)
  r.style.setProperty('--active-glow', `var(--${cv}-glow)`)
}

export default function AppPage() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const handledNotification = useRef(null)
  const [highlight, setHighlight] = useState(null)
  const { items, loading, error: loadError, refresh, addItem, updateItem, deleteItem } = useItems('mine')
  const [error, showError] = useErrorToast()

  const [activeTab, setActiveTab] = useState('kitap')
  const [statusFilter, setStatusFilter] = useState('tumu')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [editingItem, setEditingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)
  const [welcomeAction, setWelcomeAction] = useState(null)

  useEffect(() => {
    applyTabTheme(activeTab)
  }, [activeTab])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setEditingItem(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (loading || loadError || handledNotification.current === location.key) return
    const target = new URLSearchParams(location.search).get('item')
    if (!target) return
    handledNotification.current = location.key
    const item = items.find(entry => String(entry.id) === target)
    if (!item) { showError('Bu içerik artık mevcut değil.'); return }
    setActiveTab(item.category)
    setStatusFilter('tumu')
    setSearch('')
    setHighlight({ id: item.id, key: location.key })
  }, [location, loading, loadError, items, showError])

  useEffect(() => {
    if (!highlight) return
    const card = document.getElementById('item-' + highlight.id)
    if (!card) return
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    card.focus({ preventScroll: true })
    card.classList.add('notification-highlight')
    const timer = setTimeout(() => card.classList.remove('notification-highlight'), 4000)
    return () => { clearTimeout(timer); card.classList.remove('notification-highlight') }
  }, [highlight])

  const tab = TABS[activeTab]
  const sections = [{
    userId: user.id, userName: profile?.display_name || '', isOwner: true,
    items: filterAndSortItems(items, { category: activeTab, statusFilter, search, sort }),
  }]
  const statsItems = useMemo(() => items.filter((item) => item.category === activeTab), [items, activeTab])
  const showGettingStarted = !loading && !loadError && items.length === 0

  useEffect(() => {
    if (!welcomeAction) return
    const frame = requestAnimationFrame(() => {
      const form = document.getElementById('add-item-form')
      form?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (welcomeAction === 'movie' || welcomeAction === 'series') {
        form?.querySelector('.movie-search input[type="search"]')?.focus({ preventScroll: true })
      } else if (welcomeAction === 'book') {
        document.getElementById('add-item-title')?.focus({ preventScroll: true })
      }
      setWelcomeAction(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab, welcomeAction])

  async function handleAdd(payload) {
    const emojiPool = tab.emojis
    const emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)]
    try {
      await addItem({ ...payload, user_id: user.id, category: activeTab, emoji })
    } catch (e) {
      showError('Eklenemedi: ' + e.message)
      return false
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await updateItem(id, { status })
    } catch (e) {
      showError('Güncellenemedi: ' + e.message)
    }
  }

  async function handleDelete(id) {
    await deleteItem(id)
  }

  async function handleSaveEdit(id, patch) {
    try {
      await updateItem(id, patch)
      setEditingItem(null)
    } catch (e) {
      showError('Kaydedilemedi: ' + e.message)
    }
  }


  return (
    <div>
      <AppHeader />
      <section className="profile-hero main">
        <ProfileAvatar profile={profile} />
        <div><h1>{profile?.display_name || 'Koleksiyonum'}</h1>{profile?.username && <span className="profile-username">@{profile.username}</span>}<p>{profile?.bio || 'Kitaplarım, filmlerim ve dizilerim.'}</p>
        <Link to="/profile">Profilimi düzenle</Link></div>
      </section>
      <div className="tabs">
        {Object.entries(TABS).map(([key, t]) => (
          <button
            key={key}
            className={'tab-btn' + (activeTab === key ? ' active' : '')}
            onClick={() => setActiveTab(key)}
          >
            <span className="tab-icon">{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="main">
        <StatsBar items={statsItems} labels={tab.statusLabels} />

        {showGettingStarted && <section className="getting-started" aria-labelledby="getting-started-title">
          <div className="getting-started-heading">
            <span className="getting-started-icon" aria-hidden="true">✨</span>
            <div>
              <h2 id="getting-started-title">Koleksiyonunu oluşturmaya başla</h2>
              <p>İlk içeriğini eklemek için bir yol seç. Eklediğinde bu rehber kaybolacak.</p>
            </div>
          </div>
          <div className="getting-started-actions">
            <button type="button" className="getting-started-action" onClick={() => { setActiveTab('kitap'); setWelcomeAction('book') }}>
              <span aria-hidden="true">📚</span><span><strong>Kitap ekle</strong><small>Başlık ve bilgileri gir</small></span>
            </button>
            <button type="button" className="getting-started-action" onClick={() => { setActiveTab('film'); setWelcomeAction('movie') }}>
              <span aria-hidden="true">🎬</span><span><strong>Film ara</strong><small>Katalogda bulup ekle</small></span>
            </button>
            <button type="button" className="getting-started-action" onClick={() => { setActiveTab('dizi'); setWelcomeAction('series') }}>
              <span aria-hidden="true">📺</span><span><strong>Dizi ara</strong><small>Katalogda bulup ekle</small></span>
            </button>
          </div>
        </section>}
        <AddForm key={activeTab} category={activeTab} creatorLabel={tab.creatorLabel} onSubmit={handleAdd} existingItems={statsItems} />
        {loadError && <div className="auth-error" role="alert">Koleksiyon yüklenemedi. <button onClick={refresh}>Tekrar dene</button></div>}
        {loading && <p role="status">Koleksiyon yükleniyor…</p>}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sort={sort}
          onSortChange={setSort}
        />

        <ItemsGrid
          sections={sections}
          tabEmoji={tab.emoji}
          activeFilter={statusFilter}
          search={search}
          onClearFilters={() => { setSearch(''); setStatusFilter('tumu') }}
          labels={tab.statusLabels}
          onStatusChange={handleStatusChange}
          onProgress={updateItem}
          onEdit={setEditingItem}
          onDelete={(id) => setDeletingItem(items.find((item) => item.id === id))}
        />
      </div>

      <EditModal item={editingItem} onClose={() => setEditingItem(null)} onSave={handleSaveEdit} />
      {deletingItem && <DeleteConfirm item={deletingItem} onCancel={() => setDeletingItem(null)} onConfirm={handleDelete} />}
      <ErrorToast message={error} />
    </div>
  )
}
