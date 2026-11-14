import { usePageState } from '../hooks/usePageState'
import ProfileAvatar from '../components/ProfileAvatar'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { useProfiles } from '../hooks/useProfiles'
import { useItems } from '../hooks/useItems'
import { TABS } from '../constants/tabs'
import { filterAndSortItems } from '../utils/filterSort'
import AppHeader from '../components/AppHeader'
import ProfileFriendMenu from '../components/ProfileFriendMenu'
import ItemsGrid from '../components/CollectionGrid'
import FilterBar from '../components/FilterBar'

export default function PersonPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const friends = useFriends()
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const people = useProfiles({ ids: validId ? [id] : [] })
  const collection = useItems('profile', validId ? id : null)
  const [category, setCategory] = usePageState('profileCategory', null)
  const [search, setSearch] = usePageState('search', '')
  const [statusFilter, setStatusFilter] = usePageState('statusFilter', 'tumu')
  const [sort, setSort] = usePageState('sort', 'newest')
  const person = people.byId[id]
  const canView = id === user.id || person?.is_public || friends.friendIds.includes(id)
  const tab = TABS[category]
  const featured = collection.items.filter(item => item.featured_at && TABS[item.category]).sort((a,b) => new Date(a.featured_at) - new Date(b.featured_at)).slice(0,6)
  const section = items => [{ userId: id, userName: person?.display_name, isOwner: false, items }]
  return <><AppHeader /><main className="social-main visitor-profile">
    {people.loading ? <p role="status">Profil yükleniyor…</p> : people.error ? <div className="auth-error" role="alert">Profil yüklenemedi. <button onClick={people.refresh}>Tekrar dene</button></div> : !person ? <h1>Profil bulunamadı</h1> : <>
      <section className="profile-hero visitor-profile-hero"><ProfileAvatar profile={person} /><div className="visitor-profile-identity"><div className="visitor-profile-name-row"><h1>{person.display_name}</h1>{id !== user.id && <ProfileFriendMenu key={id} personId={id} isPublic={person.is_public} />}</div><span className="profile-username">@{person.username}</span>{person.bio && <p className="visitor-profile-bio">{person.bio}</p>}
        {id === user.id && <div className="profile-owner-links"><Link to="/app">Koleksiyonumu yönet</Link><Link to="/profile">Profilimi düzenle</Link></div>}
      </div></section>
      {friends.error ? <div className="auth-error" role="alert">Arkadaşlık bilgileri yüklenemedi. <button onClick={friends.refresh}>Tekrar dene</button></div> : friends.loading ? <p role="status">Arkadaşlık kontrol ediliyor…</p> : !canView ? <div className="social-empty"><h2>Bu koleksiyon arkadaşlara özel</h2><p>Arkadaşlık isteğin kabul edildiğinde koleksiyonu görebilirsin.</p></div> : <>
        {collection.error ? <div className="auth-error" role="alert">Koleksiyon yüklenemedi. <button onClick={collection.refresh}>Tekrar dene</button></div> : <>
          <div className="profile-category-summary" role="group" aria-label="Koleksiyon kategorileri">
            {Object.entries(TABS).map(([key, value]) => <button key={key} aria-pressed={category === key} onClick={() => { setCategory(category === key ? null : key); setSearch(''); setStatusFilter('tumu') }}>
              <span aria-hidden="true">{value.emoji}</span><span>{value.label}</span><strong>{collection.loading ? '—' : collection.items.filter(item => item.category === key).length}</strong>
            </button>)}
          </div>
          {collection.loading && <p role="status">Koleksiyon güncelleniyor…</p>}
          {!tab ? <>
            {!!featured.length && <section className="profile-featured"><h2>Öne çıkanlar</h2><ItemsGrid compact sections={section(featured)} activeFilter="tumu" /></section>}
            {!collection.loading && !featured.length && <p className="profile-empty">Koleksiyonu görmek için bir kategori seç.</p>}
          </> : <section className="profile-category-content" aria-label={`${tab.label} koleksiyonu`}>
            <div className="profile-category-heading"><h2>{tab.label}</h2><button className="btn-cancel" type="button" onClick={() => setCategory(null)}>Profile dön</button></div>
            <FilterBar category={category} search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sort={sort} onSortChange={setSort} />
            <ItemsGrid compact musicOwner={category === 'muzik' ? id : null} allSongs={collection.items.filter(i => i.category === 'muzik')} sections={section(filterAndSortItems(collection.items, { category, search, statusFilter, sort }))} tabEmoji={tab.emoji} activeFilter={statusFilter} search={search} onClearFilters={() => { setSearch(''); setStatusFilter('tumu') }} labels={tab.statusLabels} />
          </section>}
        </>}
      </>}
    </>}
  </main></>
}
