import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useItems } from '../hooks/useItems'
import { useProfiles } from '../hooks/useProfiles'
import { useErrorToast } from '../hooks/useErrorToast'
import { TABS } from '../constants/tabs'
import { filterAndSortItems } from '../utils/filterSort'
import AddForm from '../components/AddForm'
import FilterBar from '../components/FilterBar'
import StatsBar from '../components/StatsBar'
import ItemsGrid from '../components/ItemsGrid'
import EditModal from '../components/EditModal'
import ErrorToast from '../components/ErrorToast'

function applyTabTheme(tab) {
  const cv = TABS[tab].colorVar
  const r = document.documentElement
  r.style.setProperty('--active', `var(--${cv})`)
  r.style.setProperty('--active-light', `var(--${cv}-light)`)
  r.style.setProperty('--active-pale', `var(--${cv}-pale)`)
  r.style.setProperty('--active-glow', `var(--${cv}-glow)`)
}

export default function AppPage() {
  const { user, profile, signOut } = useAuth()
  const { items, addItem, updateItem, deleteItem } = useItems()
  const { profiles, byId } = useProfiles()
  const [error, showError] = useErrorToast()

  const [activeTab, setActiveTab] = useState('kitap')
  const [statusFilter, setStatusFilter] = useState('tumu')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [viewMode, setViewMode] = useState('mine') // 'mine' | 'all' | <profileId>
  const [editingItem, setEditingItem] = useState(null)

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
  const viewedUserId = viewMode === 'mine' ? user.id : viewMode
  const isOtherSingleView = viewMode !== 'mine' && viewMode !== 'all'

  const sections = useMemo(() => {
    const opts = { category: activeTab, statusFilter, search, sort }
    if (viewMode === 'all') {
      return profiles.map((p) => ({
        userId: p.id,
        userName: `${p.avatar_emoji} ${p.display_name}`,
        isOwner: p.id === user.id,
        items: filterAndSortItems(items.filter((i) => i.user_id === p.id), opts),
      }))
    }
    const uid = viewedUserId
    const ownerProfile = byId[uid]
    return [
      {
        userId: uid,
        userName: ownerProfile ? `${ownerProfile.avatar_emoji} ${ownerProfile.display_name}` : '',
        isOwner: uid === user.id,
        items: filterAndSortItems(items.filter((i) => i.user_id === uid), opts),
      },
    ]
  }, [items, profiles, byId, viewMode, viewedUserId, activeTab, statusFilter, search, sort, user.id])

  const statsItems = useMemo(() => {
    const uids = viewMode === 'all' ? profiles.map((p) => p.id) : [viewedUserId]
    return items.filter((i) => i.category === activeTab && uids.includes(i.user_id))
  }, [items, profiles, viewMode, viewedUserId, activeTab])

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
    try {
      await deleteItem(id)
    } catch (e) {
      showError('Silinemedi: ' + e.message)
    }
  }

  async function handleSaveEdit(id, patch) {
    try {
      await updateItem(id, patch)
      setEditingItem(null)
    } catch (e) {
      showError('Kaydedilemedi: ' + e.message)
    }
  }

  const otherProfiles = profiles.filter((p) => p.id !== user.id)

  return (
    <div>
      <div className="app-header">
        <div className="app-header-left">
          <div className="app-logo">Koleksiyonum</div>
          {profile && (
            <div className="active-user-pill">{profile.avatar_emoji} {profile.display_name}</div>
          )}
        </div>
        <div className="app-header-right">
          <Link className="btn-imdb-link" to="/imdb">⭐ IMDb Listesi</Link>
          <Link className="btn-imdb-link" to="/profile">👤 Profil</Link>
          <button className="btn-switch-user" onClick={signOut}>↩ Çıkış</button>
        </div>
      </div>

      {otherProfiles.length > 0 && (
        <div className="collection-switcher">
          <label htmlFor="collection-select">Koleksiyon:</label>
          <select id="collection-select" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="mine">Benimkiler</option>
            {otherProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.avatar_emoji} {p.display_name}</option>
            ))}
            <option value="all">🔀 Hepsi</option>
          </select>
        </div>
      )}

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

        {isOtherSingleView && byId[viewedUserId] && (
          <div className="view-banner visible">
            👀 <span>{byId[viewedUserId].display_name}'in koleksiyonuna bakıyorsun — sadece görüntülüyorsun.</span>
          </div>
        )}

        <AddForm creatorLabel={tab.creatorLabel} disabled={viewMode !== 'mine'} onSubmit={handleAdd} />

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
          onDelete={handleDelete}
        />
      </div>

      <EditModal item={editingItem} onClose={() => setEditingItem(null)} onSave={handleSaveEdit} />
      <ErrorToast message={error} />
    </div>
  )
}
