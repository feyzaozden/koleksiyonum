import { useEffect, useState } from 'react'
import { request } from './client'

export default function CatalogSearch({ category, onSelect, disabled }) {
  const [query, setQuery] = useState(''), [results, setResults] = useState([])
  const [error, setError] = useState(''), [loading, setLoading] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setResults([]); setError(''); setLoading(false)
    if (query.trim().length < 2 || disabled) return () => controller.abort()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await request(`/api/collection/catalog?category=${category}&q=${encodeURIComponent(query.trim())}`, controller.signal)
        if (!controller.signal.aborted) { setResults(data.results); if (!data.results.length) setError('Sonuç bulunamadı. Elle ekleyebilirsin.') }
      } catch (err) { if (!controller.signal.aborted) setError(err.message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, category, disabled])
  return <section className="movie-search"><label>{category === 'film' ? 'Film' : 'Dizi'} ara<input type="search" maxLength={100} disabled={disabled} value={query} onChange={e => setQuery(e.target.value)} /></label>
    {loading && <p role="status">Aranıyor…</p>}{error && <p role="alert">{error}</p>}
    <ul className="movie-search-results">{results.map(item => <li key={item.id}><button type="button" className="movie-search-result" disabled={disabled} onClick={() => { onSelect(item); setQuery(''); setResults([]) }}>
      {item.poster_path && <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt="" />}<span>{item.title} · {item.year}</span>
    </button></li>)}</ul>
  </section>
}
