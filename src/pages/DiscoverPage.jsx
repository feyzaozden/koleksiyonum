import ProfileAvatar from '../components/ProfileAvatar'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { useProfiles } from '../hooks/useProfiles'
import AppHeader from '../components/AppHeader'
import FriendActions from '../components/FriendActions'
import { usernameSearch } from '../utils/username'

export default function DiscoverPage() {
  const { user } = useAuth()
  const friends = useFriends()
  const [tab, setTab] = useState('search')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [input])
  const ids = tab === 'friends' ? friends.friendIds : tab === 'requests'
    ? friends.rows.filter((row) => row.status === 'pending').map((row) => row.requester_id === user.id ? row.recipient_id : row.requester_id) : null
  const people = useProfiles({ search, ids, page })
  const profiles = people.profiles.filter((p) => p.id !== user.id && (tab === 'search' || p.username?.includes(usernameSearch(input))))
  function selectTab(value) { setTab(value); setPage(0); setInput(''); setSearch('') }
  return <>
    <AppHeader />
    <main className="social-main">
      <div className="social-heading"><p className="eyebrow">Birlikte keşfet</p><h1>İyi hikâyeler paylaşılır.</h1>
        <p>Arkadaşlarını bul; kitaplarınızı, filmlerinizi ve dizilerinizi birbirinizle paylaşın.</p></div>
      <div className="social-tabs" aria-label="Kişiler">
        <button className={tab === 'search' ? 'selected' : ''} onClick={() => selectTab('search')}>Kullanıcı ara</button>
        <button className={tab === 'friends' ? 'selected' : ''} onClick={() => selectTab('friends')}>Arkadaşlarım ({friends.friendIds.length})</button>
        <button className={tab === 'requests' ? 'selected' : ''} onClick={() => selectTab('requests')}>İstekler {friends.incoming.length > 0 && `(${friends.incoming.length} gelen)`}</button>
      </div>
      <label className="social-search">Kullanıcı adına göre ara
        <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Arkadaşının kullanıcı adını yaz…" maxLength={80} autoCapitalize="none" spellCheck={false} />
      </label>
      <p className="social-hint">Ad Soyad, kullanıcı adı, avatar ve biyografi keşfetmek için görünür. Koleksiyonlarınız yalnızca arkadaşlık kabul edildiğinde birbirinize açılır.</p>
      {friends.error && <div className="auth-error" role="alert">Arkadaşlık bilgileri yüklenemedi. <button onClick={friends.refresh}>Tekrar dene</button></div>}
      {people.error ? <div className="auth-error" role="alert">Kişiler yüklenemedi. <button onClick={people.refresh}>Tekrar dene</button></div>
        : people.loading || friends.loading ? <p role="status">Kişiler yükleniyor…</p>
        : profiles.length === 0 ? <div className="social-empty"><h2>{tab === 'requests' ? 'Bekleyen istek yok' : tab === 'friends' ? 'Henüz gösterilecek arkadaş yok' : 'Kullanıcı bulunamadı'}</h2><p>{tab === 'search' ? 'Başka bir kullanıcı adıyla aramayı dene.' : 'Kullanıcı ara sekmesinden arkadaşlarını bulabilirsin.'}</p></div>
        : <div className="people-grid">{profiles.map((person) => <article className="person-card" key={person.id}>
          <ProfileAvatar profile={person} />
          <h2><Link to={`/people/${person.id}`}>{person.display_name}</Link></h2>
          <span className="profile-username">@{person.username}</span>
          <p>{person.bio || 'Yeni hikâyelerin peşinde.'}</p>
          {friends.relationship(person.id)?.status === 'pending' && <small>{friends.relationship(person.id).recipient_id === user.id ? 'Sana arkadaşlık isteği gönderdi' : 'Gönderdiğin istek'}</small>}
          {friends.friendIds.includes(person.id) && <Link className="collection-link" to={`/people/${person.id}`}>Koleksiyonunu görüntüle →</Link>}
          <FriendActions personId={person.id} />
        </article>)}</div>}
      {tab === 'search' && <div className="pagination"><button disabled={page === 0 || people.loading} onClick={() => setPage(page - 1)}>Önceki</button><span>Sayfa {page + 1}</span><button disabled={!people.hasMore || people.loading} onClick={() => setPage(page + 1)}>Sonraki</button></div>}
    </main>
  </>
}
