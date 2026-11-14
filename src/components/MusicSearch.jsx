import { useRef, useState } from 'react'
import { musicApi } from '../lib/musicApi'

export default function MusicSearch({ onSelect, disabled }) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('youtube')
  const [nextPage, setNextPage] = useState(null)
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  async function search(event, page = '') {
    event.preventDefault()
    if (disabled || busy || query.trim().length < 2) return
    const current = ++request.current
    setBusy(true); setError(''); if (!page) { setResults(null); setNextPage(null) }
    try {
      const data = await musicApi({ q: query.trim(), ...(source === 'youtube' ? { videos: '1', ...(page ? { page } : {}) } : {}) })
      if (request.current === current) {
        const found = source === 'youtube' ? data.results.map(video => ({ id: video.id, source: 'youtube', title: video.title, creator: video.channel, year: '', album: '', release_id: null })) : data.results
        setResults(previous => page ? [...(previous || []), ...found.filter(song => !previous?.some(old => old.id === song.id))] : found)
        setNextPage(data.nextPage || null)
      }
    } catch (err) { if (request.current === current) setError(err.message) }
    finally { if (request.current === current) setBusy(false) }
  }
  return <section className="music-search" aria-label="Şarkı ara">
    <div className="music-source-tabs" role="group" aria-label="Müzik arama kaynağı">{[['youtube','YouTube’da ara'],['catalog','Müzik kataloğu']].map(([value,label]) => <button type="button" className={'filter-btn' + (source === value ? ' active' : '')} key={value} disabled={disabled} aria-pressed={source === value} onClick={() => { request.current++; setSource(value); setResults(null); setNextPage(null); setBusy(false); setError('') }}>{label}</button>)}</div>
    <div className="music-search-bar">
      <input aria-label="Şarkı veya sanatçı ara" placeholder="Şarkı veya sanatçı ara" maxLength={100} value={query} disabled={disabled}
        onChange={e => { request.current++; setBusy(false); setResults(null); setNextPage(null); setQuery(e.target.value) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); search(e) } }} />
      <button type="button" className="btn-save" disabled={disabled || busy || query.trim().length < 2} onClick={search}>{busy ? 'Aranıyor…' : 'Ara'}</button>
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {results?.length === 0 && <p role="status">Şarkı bulunamadı. Sanatçı adıyla birlikte aramayı dene.</p>}
    {results && <div className="music-results">{results.map((song, index) => <button className="music-result" type="button" disabled={disabled} key={`${song.id}:${song.release_id}:${index}`} onClick={() => { onSelect(song); setResults(null) }}>
      <MusicCover releaseId={song.release_id} youtubeId={song.source === 'youtube' ? song.id : null} />
      <span><strong>{song.title}</strong><span>{song.source === 'youtube' ? 'Kanal: ' : ''}{song.creator}</span><small>{song.source === 'youtube' ? 'YouTube' : [song.album, song.year].filter(Boolean).join(' · ') || 'Albüm bilgisi yok'}</small></span>
    </button>)}</div>}
    {nextPage && results && <button type="button" className="btn-cancel" disabled={disabled || busy} onClick={event => search(event, nextPage)}>{busy ? 'Yükleniyor…' : 'Daha fazla sonuç'}</button>}
  </section>
}

export function MusicCover({ releaseId, youtubeId }) {
  const [failed, setFailed] = useState(null)
  const url = youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId) ? `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg` : releaseId ? `https://coverartarchive.org/release/${releaseId}/front-250` : null
  return <span className={'music-cover' + (youtubeId ? ' music-cover-youtube' : '')}>{url && failed !== url
    ? <img src={url} alt="" loading="lazy" onError={() => setFailed(url)} />
    : <span aria-hidden="true">🎵</span>}</span>
}
