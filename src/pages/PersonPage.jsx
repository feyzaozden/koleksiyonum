import ProfileAvatar from '../components/ProfileAvatar'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { useProfiles } from '../hooks/useProfiles'
import { useItems } from '../hooks/useItems'
import { TABS } from '../constants/tabs'
import { filterAndSortItems } from '../utils/filterSort'
import AppHeader from '../components/AppHeader'
import FriendActions from '../components/FriendActions'
import ItemsGrid from '../components/ItemsGrid'
import FilterBar from '../components/FilterBar'

export default function PersonPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const friends = useFriends()
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const people = useProfiles({ ids: validId ? [id] : [] })
  const collection = useItems('circle', id)
  const [category, setCategory] = useState('kitap')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('tumu')
  const [sort, setSort] = useState('newest')
  const person = people.byId[id]
  const canView = id === user.id || friends.friendIds.includes(id)
  const tab = TABS[category]
  return <><AppHeader /><main className="social-main">
    <Link className="collection-link" to="/discover">← Keşfet’e dön</Link>
    {people.loading ? <p role="status">Profil yükleniyor…</p> : people.error ? <div className="auth-error" role="alert">Profil yüklenemedi. <button onClick={people.refresh}>Tekrar dene</button></div> : !person ? <h1>Profil bulunamadı</h1> : <>
      <section className="profile-hero"><ProfileAvatar profile={person} /><div><h1>{person.display_name}</h1><span className="profile-username">@{person.username}</span><p>{person.bio || 'Kitap, film ve dizi koleksiyonu'}</p>
        {id === user.id ? <Link to="/profile">Profilimi düzenle</Link> : <FriendActions personId={id} />}</div></section>
      {friends.error ? <div className="auth-error" role="alert">Arkadaşlık bilgileri yüklenemedi. <button onClick={friends.refresh}>Tekrar dene</button></div> : friends.loading ? <p role="status">Arkadaşlık kontrol ediliyor…</p> : !canView ? <div className="social-empty"><h2>Bu koleksiyon arkadaşlara özel</h2><p>Arkadaşlık isteğin kabul edildiğinde birbirinizin koleksiyonlarını ve puanlarını görebilirsiniz.</p></div> : <>
        {id === user.id && <p><Link to="/app">Koleksiyonumu düzenle →</Link></p>}
        {collection.loading ? <p role="status">Koleksiyon yükleniyor…</p> : collection.error ? <div className="auth-error" role="alert">Koleksiyon yüklenemedi. <button onClick={collection.refresh}>Tekrar dene</button></div> : <>
          <div className="social-tabs">{Object.entries(TABS).map(([key, value]) => <button key={key} className={category === key ? 'selected' : ''} onClick={() => setCategory(key)}>{value.emoji} {value.label} ({collection.items.filter((item) => item.category === key).length})</button>)}</div>
          <FilterBar search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sort={sort} onSortChange={setSort} />
          <ItemsGrid sections={[{ userId: id, userName: person.display_name, isOwner: false, items: filterAndSortItems(collection.items, { category, search, statusFilter, sort }) }]} tabEmoji={tab.emoji} activeFilter={statusFilter} labels={tab.statusLabels} />
        </>}
      </>}
    </>}
  </main></>
}
