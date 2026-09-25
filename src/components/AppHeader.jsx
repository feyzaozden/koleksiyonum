import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import Brand from './Brand'

export default function AppHeader() {
  const { signOut } = useAuth()
  const { incoming } = useFriends()
  return (
    <header className="app-header">
      <NavLink className="brand" to="/app" aria-label="Koleksiyonum ana sayfa">
        <Brand />
      </NavLink>
      <nav className="app-header-right" aria-label="Ana menü">
        <NavLink className="btn-imdb-link" to="/app">Koleksiyonum</NavLink>
        <NavLink className="btn-imdb-link" to="/discover">Keşfet{incoming.length > 0 && <span className="nav-badge" aria-label={`${incoming.length} gelen arkadaşlık isteği`}>{incoming.length}</span>}</NavLink>
        <NavLink className="btn-imdb-link" to="/imdb">⭐ IMDb</NavLink>
        <NavLink className="btn-imdb-link" to="/profile">Profilim</NavLink>
        <button className="btn-switch-user" onClick={signOut}>Çıkış</button>
      </nav>
    </header>
  )
}
