import { useRef, useState } from 'react'
import { musicApi } from '../lib/musicApi'

export default function MusicSearch({ onSelect, disabled }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  async function search(event) {
    event.preventDefault()
    const current = ++request.current
    setBusy(true); setError(''); setResults(null)
    try {
      const data = await musicApi({ q: query.trim() })
      if (request.current === current) setResults(data.results)
    } catch (err) { if (request.current === current) setError(err.message) }
    finally { if (request.current === current) setBusy(false) }
  }
  return <section className="music-search" aria-label="Şarkı ara">
    <div className="music-search-bar">
      <input aria-label="Şarkı veya sanatçı ara" placeholder="Şarkı veya sanatçı ara" maxLength={100} value={query} disabled={disabled}
        onChange={e => { request.current++; setBusy(false); setResults(null); setQuery(e.target.value) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); search(e) } }} />
      <button type="button" className="btn-save" disabled={disabled || busy || query.trim().length < 2} onClick={search}>{busy ? 'Aranıyor…' : 'Ara'}</button>
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {results?.length === 0 && <p role="status">Şarkı bulunamadı. Sanatçı adıyla birlikte aramayı dene.</p>}
    {results && <div className="music-results">{results.map((song, index) => <button className="music-result" type="button" disabled={disabled} key={`${song.id}:${song.release_id}:${index}`} onClick={() => { onSelect(song); setResults(null) }}>
      <MusicCover releaseId={song.release_id} />
      <span><strong>{song.title}</strong><span>{song.creator}</span><small>{[song.album, song.year].filter(Boolean).join(' · ') || 'Albüm bilgisi yok'}</small></span>
    </button>)}</div>}
  </section>
}

export function MusicCover({ releaseId }) {
  const [failed, setFailed] = useState(null)
  return <span className="music-cover">{releaseId && failed !== releaseId
    ? <img src={`https://coverartarchive.org/release/${releaseId}/front-250`} alt="" loading="lazy" onError={() => setFailed(releaseId)} />
    : <span aria-hidden="true">🎵</span>}</span>
}
