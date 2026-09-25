import { NavLink } from 'react-router-dom'
import { useFriends } from '../context/FriendsContext'
import Brand from './Brand'

export default function AppHeader() {
  const { incoming } = useFriends()
  return (
    <header className="app-header">
      <NavLink className="brand" to="/app" aria-label="Koleksiyonum ana sayfa">
        <Brand />
      </NavLink>
      <nav className="app-header-right" aria-label="Ana menü">
        <div className="nav-primary">
        <NavLink className="btn-imdb-link" to="/app">Koleksiyonum</NavLink>
        <NavLink className="btn-imdb-link" to="/discover">Keşfet{incoming.length > 0 && <span className="nav-badge" aria-label={`${incoming.length} gelen arkadaşlık isteği`}>{incoming.length}</span>}</NavLink>
        <NavLink className="btn-imdb-link" to="/imdb">⭐ IMDb</NavLink>
        <NavLink className="btn-imdb-link" to="/profile">Profilim</NavLink>
        </div>
      </nav>
    </header>
  )
}
