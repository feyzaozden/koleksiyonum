import { useEffect, useRef, useState } from 'react'

export default function AddToPlaylist({ song, playlists, memberships, loading, loadError, onRetry, onAdd, onCreate, onClose }) {
  const dialog = useRef(null)
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    const el = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    el.showModal(); document.body.style.overflow = 'hidden'
    return () => { el.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  async function add(playlist) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try { await onAdd(playlist.id, song.id); setMessage(`“${playlist.name}” listesine eklendi.`) }
    catch (err) { setError(err.message) }
    finally { locked.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="add-item-dialog music-editor" aria-labelledby="add-to-playlist-title" onCancel={e => { e.preventDefault(); if (!locked.current) onClose() }}>
    <div className="add-item-dialog-heading"><h2 id="add-to-playlist-title">Çalma listesine ekle</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Kapat">×</button></div>
    <p>{song.title} · {song.creator}</p>
    {loading ? <p role="status">Listeler yükleniyor…</p> : loadError ? <p role="alert">Listeler yüklenemedi. <button className="btn-cancel" onClick={onRetry}>Tekrar dene</button></p> : <>
      {!playlists.length && <p>Henüz çalma listen yok. Önce bir liste oluştur.</p>}
      {playlists.map(playlist => {
        const exists = memberships.some(m => m.playlist_id === playlist.id && m.item_id === song.id)
        return <button className="music-result" type="button" key={playlist.id} disabled={busy || exists} onClick={() => add(playlist)}><span><strong>{playlist.name}</strong>{exists && <small>✓ Bu listede</small>}</span></button>
      })}
      <button className="btn-cancel" type="button" disabled={busy} onClick={onCreate}>+ Çalma listesi oluştur</button>
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="music-editor-footer"><button className="btn-save" type="button" disabled={busy} onClick={onClose}>Tamam</button></div>
  </dialog>
}
