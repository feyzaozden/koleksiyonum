import { useEffect, useRef, useState } from 'react'
import { musicApi } from '../lib/musicApi'
import { useAuth } from '../context/AuthContext'

let apiReady
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiReady) apiReady = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const timer = setTimeout(() => { apiReady = null; reject(new Error('Oynatıcı yüklenemedi. İnternet bağlantını kontrol et.')) }, 15000)
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(window.YT) }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => { clearTimeout(timer); apiReady = null; reject(new Error('YouTube oynatıcısı yüklenemedi.')) }
    document.head.appendChild(script)
  })
  return apiReady
}

function Video({ id, onEnded, onError }) {
  const root = useRef(null)
  const ended = useRef(onEnded), error = useRef(onError)
  ended.current = onEnded; error.current = onError
  useEffect(() => {
    let cancelled = false, player
    youtubeAPI().then(YT => {
      if (cancelled) return
      const element = document.createElement('div')
      root.current.appendChild(element)
      player = new YT.Player(element, {
        width: '100%', height: '300', videoId: id,
        playerVars: { playsinline: 1, origin: window.location.origin },
        events: { onReady: e => e.target.playVideo(), onStateChange: e => { if (e.data === 0) ended.current() }, onError: () => error.current('Bu video burada oynatılamıyor. Başka bir video seçebilirsin.') },
      })
    }).catch(err => { if (!cancelled) error.current(err.message) })
    const element = root.current
    return () => { cancelled = true; player?.destroy(); element?.replaceChildren() }
  }, [id])
  return <div className="music-video" ref={root} />
}

export default function MusicPlayer({ items, onClose, onVideoSaved }) {
  const { user } = useAuth()
  const dialog = useRef(null)
  const request = useRef(0)
  const [index, setIndex] = useState(0)
  const [choices, setChoices] = useState(null)
  const [selected, setSelected] = useState({})
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const item = items[index]
  const video = selected[item.id] || item.youtube_id
  useEffect(() => {
    const el = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    el.showModal(); document.body.style.overflow = 'hidden'
    return () => { request.current++; el.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  function move(next) { request.current++; setIndex(next); setChoices(null); setError(''); setChoosing(false); setBusy(false) }
  async function search() {
    const version = ++request.current
    setBusy(true); setError(''); setChoosing(true)
    try {
      const data = await musicApi({ videos: '1', q: `${item.creator || ''} ${item.title}`.slice(0, 100) })
      if (version === request.current) setChoices(data.results)
    } catch (err) { if (version === request.current) setError(err.message) }
    finally { if (version === request.current) setBusy(false) }
  }
  async function choose(id) {
    const version = ++request.current
    setBusy(true); setError('')
    try {
      if (user.id === item.user_id) {
        await musicApi({}, { method: 'PATCH', body: JSON.stringify({ item_id: item.id, video_id: id }) })
        onVideoSaved?.(item.id, id)
      }
      if (version === request.current) { setSelected(prev => ({ ...prev, [item.id]: id })); setChoosing(false); setChoices(null) }
    } catch (err) { if (version === request.current) setError(err.message) }
    finally { if (version === request.current) setBusy(false) }
  }
  return <dialog ref={dialog} className="add-item-dialog music-player" aria-labelledby="music-player-title" onCancel={e => { e.preventDefault(); onClose() }}>
    <div className="add-item-dialog-heading"><h2 id="music-player-title">{item.title}</h2><button type="button" aria-label="Oynatıcıyı kapat" onClick={onClose}>×</button></div>
    <p>{item.creator}{items.length > 1 ? ` · ${index + 1}/${items.length}` : ''}</p>
    {video && !choosing && <Video key={`${item.id}:${video}`} id={video} onError={setError} onEnded={() => { if (index < items.length - 1) move(index + 1) }} />}
    <button type="button" className="btn-cancel" disabled={busy} onClick={search}>{busy ? 'Yükleniyor…' : video ? 'Başka video seç' : 'Dinlemek için video seç'}</button>
    {choices?.length === 0 && <p>Oynatılabilir video bulunamadı.</p>}
    {choosing && choices?.map(choice => <button type="button" className="music-result" key={choice.id} disabled={busy} onClick={() => choose(choice.id)}><span><strong>{choice.title}</strong><small>{choice.channel}</small></span></button>)}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {items.length > 1 && <div className="music-list-actions"><button className="btn-cancel" disabled={index === 0} onClick={() => move(index - 1)}>Önceki</button><button className="btn-cancel" disabled={index === items.length - 1} onClick={() => move(index + 1)}>Sonraki</button></div>}
    <small>Oynatma YouTube üzerinden yapılır. Video kullanılamıyorsa başka bir sürüm seçebilirsin.</small>
  </dialog>
}
