import { useEffect, useRef, useState } from 'react'
import { getMovies } from '../lib/movieApi'

export default function MovieSearch({ category = 'film', onSelect, onPendingChange, disabled }) {
  const isSeries = category === 'dizi'
  const label = isSeries ? 'Dizi' : 'Film'
  const plural = isSeries ? 'Diziler' : 'Filmler'
  const [manual, setManual] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [retry, setRetry] = useState(0)
  const selection = useRef(null)
  const searchInput = useRef(null)

  useEffect(() => {
    onPendingChange(selecting)
    return () => onPendingChange(false)
  }, [selecting, onPendingChange])
  useEffect(() => () => selection.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    setResults([])
    setSearched(false)
    setError('')
    if (manual || query.trim().length < 2) { setLoading(false); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await getMovies({ q: query.trim() }, controller.signal, category)
        if (!controller.signal.aborted) { setResults(data.results); setSearched(true) }
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message || 'Arama yapılamadı. Tekrar dene.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, manual, retry, category])

  async function choose(movie) {
    selection.current?.abort()
    const controller = new AbortController()
    selection.current = controller
    setSelecting(true)
    setError('')
    try {
      const data = await getMovies({ id: String(movie.id) }, controller.signal, category)
      if (controller.signal.aborted) return
      const item = isSeries ? data.series : data.movie
      onSelect(item)
      setQuery('')
      setSelected(`${item.title}${item.year ? ` (${item.year})` : ''} forma aktarıldı.`)
      searchInput.current?.focus({ preventScroll: true })
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message || `${label} bilgileri alınamadı.`)
    } finally {
      if (!controller.signal.aborted) setSelecting(false)
    }
  }

  return <section className="movie-search" aria-label={`${label} arama`} onKeyDown={(e) => e.stopPropagation()}>
    <div className="movie-search-heading">
      <label htmlFor="movie-query">{manual ? (isSeries ? 'Dizini elle ekle' : 'Filmini elle ekle') : `${label} ara`}</label>
      <button type="button" className="movie-search-switch" disabled={disabled || selecting} onClick={() => {
        setManual(!manual); setQuery(''); setSelected('')
      }}>{manual ? `${label} aramaya dön` : 'Kendim eklemek istiyorum'}</button>
    </div>
    {!manual && <>
      <input ref={searchInput} id="movie-query" type="search" placeholder={isSeries ? 'Dizi adı yaz… Örn. Leyla ile Mecnun' : 'Film adı yaz… Örn. Yıldızlararası'} maxLength={100}
        autoComplete="off" value={query} disabled={disabled || selecting} onChange={(e) => { setQuery(e.target.value); setSelected('') }} />
      <div role="status" aria-live="polite">
        {selecting ? `${label} bilgileri alınıyor…` : loading ? `${plural} aranıyor…` : selected}
        {!loading && searched && !results.length && `${label} bulunamadı. Özgün adıyla arayabilir veya elle ekleyebilirsin.`}
      </div>
      {error && <div className="auth-error" role="alert">{error} <button type="button" className="movie-search-switch" disabled={selecting || disabled} onClick={() => setRetry((value) => value + 1)}>Tekrar dene</button></div>}
      {results.length > 0 && <ul className="movie-search-results" aria-label={`Bulunan ${isSeries ? 'diziler' : 'filmler'}`}>
        {results.map((movie) => <li key={movie.id}>
          <button type="button" className="movie-search-result" disabled={disabled || selecting} onClick={() => choose(movie)}>
            {movie.poster ? <img src={movie.poster} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /> : <span className="movie-search-poster" aria-hidden="true">{isSeries ? '📺' : '🎬'}</span>}
            <span className="movie-search-result-text"><strong>{movie.title}</strong>
              <small>{movie.year || 'Yıl bilgisi yok'}{movie.originalTitle && movie.originalTitle !== movie.title ? ` · ${movie.originalTitle}` : ''}</small>
            </span><span className="movie-search-pick">Seç</span>
          </button>
        </li>)}
      </ul>}
    </>}
  </section>
}
