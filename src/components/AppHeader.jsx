import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'

export default function AppHeader() {
  const { signOut } = useAuth()
  const { incoming } = useFriends()
  return (
    <header className="app-header">
      <NavLink className="app-logo" to="/app">Koleksiyonum</NavLink>
      <nav className="app-header-right" aria-label="Ana menü">
        <NavLink className="btn-imdb-link" to="/app">Koleksiyonum</NavLink>
        <NavLink className="btn-imdb-link" to="/discover">Keşfet{incoming.length > 0 && ` (${incoming.length})`}</NavLink>
        <NavLink className="btn-imdb-link" to="/imdb">⭐ IMDb</NavLink>
        <NavLink className="btn-imdb-link" to="/profile">Profilimi düzenle</NavLink>
        <button className="btn-switch-user" onClick={signOut}>Çıkış</button>
      </nav>
    </header>
  )
}
