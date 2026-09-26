import ProfileAvatar from '../components/ProfileAvatar'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const { items, loading, error: loadError, refresh, addItem, updateItem, deleteItem } = useItems('mine')
  const [error, showError] = useErrorToast()

  const [activeTab, setActiveTab] = useState('kitap')
  const [statusFilter, setStatusFilter] = useState('tumu')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [editingItem, setEditingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)

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

  const tab = TABS[activeTab]
  const sections = [{
    userId: user.id, userName: profile?.display_name || '', isOwner: true,
    items: filterAndSortItems(items, { category: activeTab, statusFilter, search, sort }),
  }]
  const statsItems = useMemo(() => items.filter((item) => item.category === activeTab), [items, activeTab])

  async function handleAdd(payload) {
    const emojiPool = tab.emojis
    const emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)]
    try {
      await addItem({ ...payload, user_id: user.id, category: activeTab, emoji })
    } catch (e) {
      showError('Eklenemedi: ' + e.message)
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

        <AddForm creatorLabel={tab.creatorLabel} onSubmit={handleAdd} />
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
          labels={tab.statusLabels}
          onStatusChange={handleStatusChange}
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
