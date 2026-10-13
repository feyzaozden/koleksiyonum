import { Link } from 'react-router-dom'

export default function AppFooter() {
  const year = new Intl.DateTimeFormat('tr-TR', { year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date())

  return <footer className="app-footer">
    <div className="app-footer-inner">
      <div className="app-footer-about">
      <small className="app-footer-copyright">© Koleksiyonum {year}</small>
      <details className="app-footer-credits">
        <summary>Kaynaklar</summary>
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src="/tmdb.svg" alt="TMDB" width="80" height="32" /></a>
        <p>Film ve dizi bilgileri ile afişler TMDB tarafından sağlanır.</p>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </details>
      </div>
      <nav className="app-footer-links" aria-label="Alt menü">
        <Link to="/privacy">Gizlilik Politikası</Link>
      </nav>
    </div>
  </footer>
}
