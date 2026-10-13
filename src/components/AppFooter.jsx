import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppFooter() {
  const { session, loading } = useAuth()
  const year = new Intl.DateTimeFormat('tr-TR', { year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date())

  return <footer className="app-footer">
    <div className="app-footer-inner">
      <div className="app-footer-about">
        <Link className="app-footer-name" to={session ? '/app' : '/login'}>koleksiyonum<span aria-hidden="true">/</span></Link>
        <p>Okudukların, izlediklerin ve kaldığın yer.</p>
      </div>
      {!loading && <nav className="app-footer-links" aria-label="Alt menü">
        {session ? <>
          <Link to="/app">Koleksiyonum</Link>
          <Link to="/discover">Keşfet</Link>
          <Link to="/profile">Profilim</Link>
        </> : <>
          <Link to="/login">Giriş yap</Link>
          <Link to="/signup">Kayıt ol</Link>
        </>}
      </nav>}
      <details className="app-footer-credits">
        <summary>Kaynaklar</summary>
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src="/tmdb.svg" alt="TMDB" width="80" height="32" /></a>
        <p>Film bilgileri ve afişler TMDB tarafından sağlanır.</p>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </details>
      <small className="app-footer-copyright">© {year} Koleksiyonum</small>
    </div>
  </footer>
}
